const MIN_TOTAL_BETS = 50;
const MIN_RESOLVED_BETS = 30;
const MAX_STABLE_OVERRIDE_RATE = 0.08;
const MAX_EXPECTED_NEGATIVE_ROI = -0.2;

const VARIANCE_NOTICE_MESSAGE = [
  "Current outcomes remain within expected variance range.",
  "Decision discipline remains healthy.",
  "No significant evidence of process degradation detected."
].join("\n");

const DEGRADATION_SIGNALS = new Set([
  "EMOTIONAL_ESCALATION",
  "LOSS_CHASING",
  "OVERRIDE_RISK",
  "STAKE_ESCALATION"
]);

function evaluateVarianceState(input = {}) {
  const averageClvPct = toNumber(input.averageClvPct);
  const roiPct = toNumber(input.roiPct);
  const totalBets = toNumber(input.totalBets);
  const resolvedBets = toNumber(input.resolvedBets);
  const overrideRate = toNumber(input.overrideRate);
  const behavioralSignals = Array.isArray(input.behavioralSignals) ? input.behavioralSignals : [];

  const reasons = {
    clvPositive: averageClvPct > 0,
    disciplineStable: isDisciplineStable({ overrideRate, behavioralSignals }),
    roiTemporarilyNegative: roiPct < 0,
    sampleSufficient: totalBets >= MIN_TOTAL_BETS && resolvedBets >= MIN_RESOLVED_BETS,
    withinVarianceRange: roiPct >= MAX_EXPECTED_NEGATIVE_ROI && roiPct < 0
  };

  const shouldDisplay = Object.values(reasons).every(Boolean);

  return {
    shouldDisplay,
    code: shouldDisplay ? "EXPECTED_VARIANCE_DISCIPLINE_STABLE" : null,
    severity: shouldDisplay ? "info" : null,
    message: shouldDisplay ? VARIANCE_NOTICE_MESSAGE : null,
    reasons
  };
}

function isDisciplineStable({ overrideRate, behavioralSignals }) {
  if (!Number.isFinite(overrideRate) || overrideRate > MAX_STABLE_OVERRIDE_RATE) {
    return false;
  }

  return !behavioralSignals.some((signal) => {
    return signal
      && signal.severity >= 2
      && DEGRADATION_SIGNALS.has(signal.signalType);
  });
}

function toNumber(value) {
  if (value && typeof value.toNumber === "function") {
    return value.toNumber();
  }

  return Number(value);
}

module.exports = {
  evaluateVarianceState,
  VARIANCE_NOTICE_MESSAGE
};
