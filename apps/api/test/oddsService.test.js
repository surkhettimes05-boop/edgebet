const { ingestOdds } = require("../src/services/oddsService");

function createPrismaMock() {
  return {
    league: { upsert: vi.fn() },
    team: { upsert: vi.fn() },
    match: { upsert: vi.fn() },
    bookmaker: { upsert: vi.fn() },
    oddsSnapshot: { createMany: vi.fn() }
  };
}

const apiMatch = {
  id: "match-1",
  sport_key: "basketball_nba",
  sport_title: "NBA",
  commence_time: "2026-05-22T20:00:00Z",
  home_team: "New York Liberty",
  away_team: "Las Vegas Aces",
  bookmakers: [
    {
      key: "sharpbook",
      title: "SharpBook",
      markets: [
        {
          key: "h2h",
          outcomes: [
            { name: "New York Liberty", price: -110 },
            { name: "Las Vegas Aces", price: -105 }
          ]
        }
      ]
    }
  ]
};

describe("odds service", () => {
  test("normalizes API odds and stores snapshots without overwriting history", async () => {
    const prisma = createPrismaMock();
    prisma.league.upsert.mockResolvedValue({ id: "league-1" });
    prisma.team.upsert
      .mockResolvedValueOnce({ id: "home-team" })
      .mockResolvedValueOnce({ id: "away-team" });
    prisma.match.upsert.mockResolvedValue({ id: "db-match" });
    prisma.bookmaker.upsert.mockResolvedValue({ id: "bookmaker-1" });
    prisma.oddsSnapshot.createMany.mockResolvedValue({ count: 2 });

    const httpClient = {
      get: vi.fn().mockResolvedValue({ data: [apiMatch] })
    };

    const result = await ingestOdds({
      prisma,
      httpClient,
      apiKey: "test-key",
      now: new Date("2026-05-22T13:00:00Z")
    });

    expect(result).toEqual({
      fetchedMatches: 1,
      normalizedSnapshots: 2,
      storedSnapshots: 2,
      skipped: false
    });
    expect(prisma.oddsSnapshot.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          matchId: "db-match",
          bookmakerId: "bookmaker-1",
          market: "MONEYLINE",
          selection: "New York Liberty",
          priceAmerican: -110,
          priceDecimal: expect.any(Number),
          impliedProb: expect.any(Number),
          bookmakerMargin: expect.any(Number),
          capturedAt: new Date("2026-05-22T13:00:00Z")
        })
      ]),
      skipDuplicates: true
    });
  });

  test("handles odds API failures gracefully", async () => {
    const prisma = createPrismaMock();
    const httpClient = {
      get: vi.fn().mockRejectedValue(new Error("upstream unavailable"))
    };

    const result = await ingestOdds({
      prisma,
      httpClient,
      apiKey: "test-key"
    });

    expect(result).toEqual({
      fetchedMatches: 0,
      normalizedSnapshots: 0,
      storedSnapshots: 0,
      skipped: true,
      error: "upstream unavailable"
    });
    expect(prisma.oddsSnapshot.createMany).not.toHaveBeenCalled();
  });
});
