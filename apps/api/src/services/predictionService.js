const MODEL_NAME = "market_implied";
const MODEL_VERSION = "market-implied-v1";
const PRIOR_MODEL_NAME = "schedule_prior";
const PRIOR_MODEL_VERSION = "schedule-prior-v1";

async function generatePredictions(options = {}) {
  const prisma = options.prisma;
  const now = options.now || new Date();

  if (!prisma) {
    throw new Error("Prisma client is required for prediction generation.");
  }

  const matches = await prisma.match.findMany({
    where: {
      status: "SCHEDULED",
      startsAt: { gte: now }
    },
    orderBy: { startsAt: "asc" },
    take: options.limit || 50,
    include: {
      league: true,
      homeTeam: true,
      awayTeam: true,
      oddsSnapshots: {
        orderBy: { capturedAt: "desc" },
        include: { bookmaker: true }
      }
    }
  });

  const rows = matches.flatMap((match) => predictionRowsForMatch(match, now));

  await prisma.modelPrediction.deleteMany({
    where: {
      OR: [
        { modelName: MODEL_NAME, modelVersion: MODEL_VERSION },
        { modelName: PRIOR_MODEL_NAME, modelVersion: PRIOR_MODEL_VERSION }
      ],
      matchId: { in: matches.map((match) => match.id) }
    }
  });

  const stored = rows.length
    ? await prisma.modelPrediction.createMany({ data: rows })
    : { count: 0 };

  return {
    matches: matches.length,
    generatedPredictions: rows.length,
    storedPredictions: stored.count,
    modelName: MODEL_NAME,
    modelVersion: MODEL_VERSION
  };
}

function predictionRowsForMatch(match, createdAt = new Date()) {
  const markets = groupLatestSnapshotsByMarket(match.oddsSnapshots || []);
  if (markets.size === 0) {
    return schedulePriorRowsForMatch(match, createdAt);
  }

  const predictions = [];

  for (const [market, snapshots] of markets) {
    const probabilities = normalizedSelectionProbabilities(match, market, snapshots);

    for (const { selection, fairProbability } of probabilities) {
      predictions.push({
        matchId: match.id,
        modelName: MODEL_NAME,
        modelVersion: MODEL_VERSION,
        market,
        selection,
        fairProbability,
        fairPriceDecimal: roundDecimal(1 / fairProbability, 4),
        edgePct: 0,
        rationale: [
          "Market-implied probability from live bookmaker odds.",
          `League=${match.league?.name || "unknown"}.`,
          "Bookmaker margin is normalized out before display."
        ].join(" "),
        createdAt
      });
    }
  }

  return predictions;
}

function schedulePriorRowsForMatch(match, createdAt = new Date()) {
  const selections = isSoccer(match)
    ? [
        ["HOME", 0.36],
        ["Draw", 0.28],
        ["AWAY", 0.36]
      ]
    : [
        ["HOME", 0.52],
        ["AWAY", 0.48]
      ];

  return selections.map(([selection, fairProbability]) => ({
    matchId: match.id,
    modelName: PRIOR_MODEL_NAME,
    modelVersion: PRIOR_MODEL_VERSION,
    market: "MONEYLINE",
    selection,
    fairProbability,
    fairPriceDecimal: roundDecimal(1 / fairProbability, 4),
    edgePct: 0,
    rationale: [
      "Schedule-prior baseline because no bookmaker odds snapshots are available for this match.",
      `League=${match.league?.name || "unknown"}.`,
      "Use as a placeholder probability, not a betting recommendation."
    ].join(" "),
    createdAt
  }));
}

function isSoccer(match) {
  const sport = match.league?.sport || "";
  return sport.startsWith("soccer_");
}

function groupLatestSnapshotsByMarket(snapshots) {
  const latestByMarket = new Map();

  for (const snapshot of snapshots) {
    const existing = latestByMarket.get(snapshot.market);
    const capturedAt = new Date(snapshot.capturedAt).getTime();
    if (!existing || capturedAt > existing.capturedAt) {
      latestByMarket.set(snapshot.market, {
        capturedAt,
        snapshots: [snapshot]
      });
    } else if (capturedAt === existing.capturedAt) {
      existing.snapshots.push(snapshot);
    }
  }

  return new Map(
    Array.from(latestByMarket, ([market, value]) => [market, value.snapshots])
  );
}

function normalizedSelectionProbabilities(match, market, snapshots) {
  const byBookmaker = new Map();

  for (const snapshot of snapshots) {
    const key = snapshot.bookmakerId || snapshot.bookmaker?.id || "unknown";
    if (!byBookmaker.has(key)) {
      byBookmaker.set(key, []);
    }
    byBookmaker.get(key).push(snapshot);
  }

  const totals = new Map();
  const counts = new Map();

  for (const bookmakerSnapshots of byBookmaker.values()) {
    const impliedTotal = bookmakerSnapshots.reduce(
      (sum, snapshot) => sum + Number(snapshot.impliedProb),
      0
    );

    if (!Number.isFinite(impliedTotal) || impliedTotal <= 0) {
      continue;
    }

    for (const snapshot of bookmakerSnapshots) {
      const selection = modelSelection(match, market, snapshot.selection);
      const probability = Number(snapshot.impliedProb) / impliedTotal;
      totals.set(selection, (totals.get(selection) || 0) + probability);
      counts.set(selection, (counts.get(selection) || 0) + 1);
    }
  }

  return Array.from(totals, ([selection, total]) => ({
    selection,
    fairProbability: clampProbability(roundDecimal(total / counts.get(selection), 6))
  })).sort((a, b) => b.fairProbability - a.fairProbability);
}

function modelSelection(match, market, selection) {
  if (market === "MONEYLINE") {
    if (selection === match.homeTeam?.name) return "HOME";
    if (selection === match.awayTeam?.name) return "AWAY";
    return selection;
  }

  if (market === "SPREAD") {
    if (selection.startsWith(match.homeTeam?.name || "")) {
      return `HOME_${selection.slice(match.homeTeam.name.length).trim()}`;
    }
    if (selection.startsWith(match.awayTeam?.name || "")) {
      return `AWAY_${selection.slice(match.awayTeam.name.length).trim()}`;
    }
  }

  if (market === "TOTAL") {
    const [side, line] = selection.split(/\s+/);
    if (side && line) {
      return `${side.toUpperCase()}_${line}`;
    }
  }

  return selection;
}

function clampProbability(value) {
  return Math.min(0.999999, Math.max(0.000001, value));
}

function roundDecimal(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

module.exports = {
  MODEL_NAME,
  MODEL_VERSION,
  PRIOR_MODEL_NAME,
  PRIOR_MODEL_VERSION,
  generatePredictions,
  predictionRowsForMatch
};
