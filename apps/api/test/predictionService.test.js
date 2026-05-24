const {
  generatePredictions,
  predictionRowsForMatch
} = require("../src/services/predictionService");

function snapshot({ market, selection, impliedProb, bookmakerId = "book-1", capturedAt = "2026-05-24T10:00:00Z" }) {
  return {
    market,
    selection,
    impliedProb,
    bookmakerId,
    bookmaker: { id: bookmakerId, name: bookmakerId },
    capturedAt: new Date(capturedAt)
  };
}

const match = {
  id: "match-1",
  startsAt: new Date("2026-05-25T10:00:00Z"),
  league: { name: "EPL", sport: "soccer_epl" },
  homeTeam: { name: "Arsenal" },
  awayTeam: { name: "Chelsea" },
  oddsSnapshots: [
    snapshot({ market: "MONEYLINE", selection: "Arsenal", impliedProb: 0.5 }),
    snapshot({ market: "MONEYLINE", selection: "Draw", impliedProb: 0.3 }),
    snapshot({ market: "MONEYLINE", selection: "Chelsea", impliedProb: 0.25 })
  ]
};

describe("prediction service", () => {
  test("creates model prediction rows from latest live market probabilities", () => {
    const rows = predictionRowsForMatch(match, new Date("2026-05-24T11:00:00Z"));

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matchId: "match-1",
          modelName: "market_implied",
          modelVersion: "market-implied-v1",
          market: "MONEYLINE",
          selection: "HOME",
          fairProbability: 0.47619,
          fairPriceDecimal: 2.1
        }),
        expect.objectContaining({
          selection: "Draw",
          fairProbability: 0.285714
        }),
        expect.objectContaining({
          selection: "AWAY",
          fairProbability: 0.238095
        })
      ])
    );
  });

  test("replaces prior market-implied predictions before storing fresh rows", async () => {
    const prisma = {
      match: {
        findMany: vi.fn().mockResolvedValue([match])
      },
      modelPrediction: {
        deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
        createMany: vi.fn().mockResolvedValue({ count: 3 })
      }
    };

    const result = await generatePredictions({
      prisma,
      now: new Date("2026-05-24T11:00:00Z")
    });

    expect(prisma.modelPrediction.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { modelName: "market_implied", modelVersion: "market-implied-v1" },
          { modelName: "schedule_prior", modelVersion: "schedule-prior-v1" }
        ],
        matchId: { in: ["match-1"] }
      }
    });
    expect(prisma.modelPrediction.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ selection: "HOME" })
      ])
    });
    expect(result).toMatchObject({
      matches: 1,
      generatedPredictions: 3,
      storedPredictions: 3
    });
  });

  test("creates transparent schedule-prior predictions when a match has no odds snapshots", () => {
    const rows = predictionRowsForMatch({
      ...match,
      oddsSnapshots: []
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          modelName: "schedule_prior",
          modelVersion: "schedule-prior-v1",
          market: "MONEYLINE",
          selection: "HOME",
          fairProbability: 0.36
        }),
        expect.objectContaining({
          selection: "Draw",
          fairProbability: 0.28
        }),
        expect.objectContaining({
          selection: "AWAY",
          fairProbability: 0.36
        })
      ])
    );
  });
});
