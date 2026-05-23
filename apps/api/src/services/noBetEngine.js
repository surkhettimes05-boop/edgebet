const EV_THRESHOLD = 0.05;

function evaluateNoBet({
  ev,
  hasOdds,
  dataQualityAcceptable,
  marketDisagreementExtreme,
  lineupUncertaintyAcceptable
}) {
  const reasons = [];

  if (!hasOdds) {
    reasons.push("MISSING_ODDS");
  }

  if (hasOdds && (!Number.isFinite(ev) || ev <= EV_THRESHOLD)) {
    reasons.push("EV_NOT_ABOVE_THRESHOLD");
  }

  if (dataQualityAcceptable !== true) {
    reasons.push("DATA_QUALITY_UNACCEPTABLE");
  }

  if (marketDisagreementExtreme === true) {
    reasons.push("MARKET_DISAGREEMENT_EXTREME");
  }

  if (lineupUncertaintyAcceptable !== true) {
    reasons.push("LINEUP_UNCERTAINTY_UNACCEPTABLE");
  }

  return {
    decision: reasons.length === 0 ? "SIGNAL" : "NO_BET",
    reasons
  };
}

module.exports = {
  EV_THRESHOLD,
  evaluateNoBet
};
