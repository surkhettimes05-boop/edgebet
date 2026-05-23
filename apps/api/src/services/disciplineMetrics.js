function summarizeDiscipline({ bets, behavioralSignals, clvRecords }) {
  const normalizedBets = Array.isArray(bets) ? bets : [];
  const normalizedSignals = Array.isArray(behavioralSignals) ? behavioralSignals : [];
  const normalizedClvRecords = Array.isArray(clvRecords) ? clvRecords : [];
  const totalStakeUnits = normalizedBets.reduce((sum, bet) => sum + toNumber(bet.stakeUnits), 0);
  const noBetViolations = normalizedBets.filter((bet) => {
    return bet.noBetRecommended === true && bet.placedAgainstRecommendation === true;
  }).length;

  return {
    totalBets: normalizedBets.length,
    totalStakeUnits: roundDecimal(totalStakeUnits, 6),
    noBetViolations,
    overrideRate: normalizedBets.length ? roundDecimal(noBetViolations / normalizedBets.length, 6) : 0,
    signalCounts: countSignals(normalizedSignals),
    averageClvPct: averageClv(normalizedClvRecords)
  };
}

function countSignals(signals) {
  return signals.reduce((counts, signal) => {
    counts[signal.signalType] = (counts[signal.signalType] || 0) + 1;
    return counts;
  }, {});
}

function averageClv(clvRecords) {
  const values = clvRecords
    .map((record) => toNumber(record.clvPct))
    .filter(Number.isFinite);

  if (values.length === 0) {
    return null;
  }

  return roundDecimal(values.reduce((sum, value) => sum + value, 0) / values.length, 6);
}

function toNumber(value) {
  if (value && typeof value.toNumber === "function") {
    return value.toNumber();
  }

  return Number(value);
}

function roundDecimal(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

module.exports = {
  summarizeDiscipline
};
