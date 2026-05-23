const { evaluateNoBet } = require("./noBetEngine");

function evaluateEv({
  modelProbability,
  odds,
  dataQualityAcceptable,
  marketDisagreementExtreme,
  lineupUncertaintyAcceptable
}) {
  const hasOdds = Number.isFinite(odds) && odds > 0;
  const ev = hasOdds ? calculateEv({ modelProbability, odds }) : null;
  const noBet = evaluateNoBet({
    ev,
    hasOdds,
    dataQualityAcceptable,
    marketDisagreementExtreme,
    lineupUncertaintyAcceptable
  });

  return {
    decision: noBet.decision,
    ev,
    reasons: noBet.reasons
  };
}

function calculateEv({ modelProbability, odds }) {
  if (!Number.isFinite(modelProbability) || modelProbability < 0 || modelProbability > 1) {
    throw new Error("Model probability must be a number between 0 and 1.");
  }

  if (!Number.isFinite(odds) || odds <= 0) {
    throw new Error("Decimal odds must be a positive number.");
  }

  return roundDecimal(modelProbability * odds - 1, 6);
}

function roundDecimal(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

module.exports = {
  calculateEv,
  evaluateEv
};
