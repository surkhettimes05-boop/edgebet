const axios = require("axios");
const {
  americanToDecimal,
  calculateBookmakerMargin,
  impliedProbabilityFromAmerican
} = require("../utils/impliedProbability");

const DEFAULT_SPORTS = ["basketball_nba"];
const DEFAULT_REGIONS = "us";
const DEFAULT_MARKETS = "h2h,spreads,totals";

const MARKET_MAP = {
  h2h: "MONEYLINE",
  spreads: "SPREAD",
  totals: "TOTAL"
};

async function ingestOdds(options = {}) {
  const prisma = options.prisma;
  const httpClient = options.httpClient || axios;
  const apiKey = options.apiKey || process.env.ODDS_API_KEY;
  const sports = options.sports || parseSports(process.env.ODDS_SPORTS) || DEFAULT_SPORTS;
  const now = options.now || new Date();

  if (!prisma) {
    throw new Error("Prisma client is required for odds ingestion.");
  }

  if (!apiKey) {
    return {
      fetchedMatches: 0,
      normalizedSnapshots: 0,
      storedSnapshots: 0,
      skipped: true,
      error: "ODDS_API_KEY is not configured."
    };
  }

  try {
    const apiMatches = await fetchOdds({ httpClient, apiKey, sports });
    const snapshots = [];

    for (const apiMatch of apiMatches) {
      const context = await persistMatchContext(prisma, apiMatch);
      const normalized = normalizeSnapshots(apiMatch, context, now);
      snapshots.push(...normalized);
    }

    const stored = snapshots.length
      ? await prisma.oddsSnapshot.createMany({
          data: snapshots,
          skipDuplicates: true
        })
      : { count: 0 };

    return {
      fetchedMatches: apiMatches.length,
      normalizedSnapshots: snapshots.length,
      storedSnapshots: stored.count,
      skipped: false
    };
  } catch (error) {
    return {
      fetchedMatches: 0,
      normalizedSnapshots: 0,
      storedSnapshots: 0,
      skipped: true,
      error: error.message
    };
  }
}

async function fetchOdds({ httpClient, apiKey, sports }) {
  const responses = await Promise.all(
    sports.map((sport) => {
      return httpClient.get(`https://api.the-odds-api.com/v4/sports/${sport}/odds`, {
        params: {
          apiKey,
          regions: process.env.ODDS_REGIONS || DEFAULT_REGIONS,
          markets: process.env.ODDS_MARKETS || DEFAULT_MARKETS,
          oddsFormat: "american",
          dateFormat: "iso"
        },
        timeout: 15000
      });
    })
  );

  return responses.flatMap((response) => response.data || []);
}

async function persistMatchContext(prisma, apiMatch) {
  const league = await prisma.league.upsert({
    where: { externalId: apiMatch.sport_key },
    update: {
      name: apiMatch.sport_title || apiMatch.sport_key,
      sport: apiMatch.sport_key
    },
    create: {
      externalId: apiMatch.sport_key,
      name: apiMatch.sport_title || apiMatch.sport_key,
      sport: apiMatch.sport_key
    }
  });

  const homeTeam = await prisma.team.upsert({
    where: { externalId: teamExternalId(apiMatch.sport_key, apiMatch.home_team) },
    update: { name: apiMatch.home_team },
    create: {
      externalId: teamExternalId(apiMatch.sport_key, apiMatch.home_team),
      name: apiMatch.home_team
    }
  });

  const awayTeam = await prisma.team.upsert({
    where: { externalId: teamExternalId(apiMatch.sport_key, apiMatch.away_team) },
    update: { name: apiMatch.away_team },
    create: {
      externalId: teamExternalId(apiMatch.sport_key, apiMatch.away_team),
      name: apiMatch.away_team
    }
  });

  const match = await prisma.match.upsert({
    where: { externalId: apiMatch.id },
    update: {
      startsAt: new Date(apiMatch.commence_time),
      leagueId: league.id,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id
    },
    create: {
      externalId: apiMatch.id,
      startsAt: new Date(apiMatch.commence_time),
      leagueId: league.id,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id
    }
  });

  const bookmakerIds = {};
  for (const apiBookmaker of apiMatch.bookmakers || []) {
    const bookmaker = await prisma.bookmaker.upsert({
      where: { externalId: apiBookmaker.key },
      update: { name: apiBookmaker.title || apiBookmaker.key },
      create: {
        externalId: apiBookmaker.key,
        name: apiBookmaker.title || apiBookmaker.key
      }
    });
    bookmakerIds[apiBookmaker.key] = bookmaker.id;
  }

  return {
    matchId: match.id,
    bookmakerIds
  };
}

function normalizeSnapshots(apiMatch, context, capturedAt) {
  const snapshots = [];

  for (const bookmaker of apiMatch.bookmakers || []) {
    const bookmakerId = context.bookmakerIds[bookmaker.key];
    if (!bookmakerId) {
      continue;
    }

    for (const market of bookmaker.markets || []) {
      const marketType = MARKET_MAP[market.key];
      if (!marketType) {
        continue;
      }

      const outcomes = (market.outcomes || [])
        .filter((outcome) => Number.isFinite(outcome.price))
        .map((outcome) => ({
          selection: selectionName(outcome, market.key),
          priceAmerican: outcome.price
        }));
      const bookmakerMargin = calculateBookmakerMargin(outcomes);

      for (const outcome of outcomes) {
        snapshots.push({
          matchId: context.matchId,
          bookmakerId,
          market: marketType,
          selection: outcome.selection,
          priceAmerican: outcome.priceAmerican,
          priceDecimal: americanToDecimal(outcome.priceAmerican),
          impliedProb: impliedProbabilityFromAmerican(outcome.priceAmerican),
          bookmakerMargin,
          capturedAt
        });
      }
    }
  }

  return snapshots;
}

function selectionName(outcome, marketKey) {
  if (marketKey === "totals" && outcome.point !== undefined) {
    return `${outcome.name} ${outcome.point}`;
  }

  if (marketKey === "spreads" && outcome.point !== undefined) {
    return `${outcome.name} ${outcome.point}`;
  }

  return outcome.name;
}

function teamExternalId(sportKey, teamName) {
  return `${sportKey}:${teamName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function parseSports(value) {
  if (!value) {
    return null;
  }

  return value
    .split(",")
    .map((sport) => sport.trim())
    .filter(Boolean);
}

module.exports = {
  ingestOdds,
  normalizeSnapshots
};
