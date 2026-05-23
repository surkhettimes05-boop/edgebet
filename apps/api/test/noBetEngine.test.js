const { evaluateNoBet } = require("../src/services/noBetEngine");

describe("No Bet engine", () => {
  test("returns no bet when lineup uncertainty is unacceptable", () => {
    const result = evaluateNoBet({
      ev: 0.12,
      hasOdds: true,
      dataQualityAcceptable: true,
      marketDisagreementExtreme: false,
      lineupUncertaintyAcceptable: false
    });

    expect(result).toEqual({
      decision: "NO_BET",
      reasons: ["LINEUP_UNCERTAINTY_UNACCEPTABLE"]
    });
  });

  test("returns no bet when data quality is unacceptable", () => {
    const result = evaluateNoBet({
      ev: 0.12,
      hasOdds: true,
      dataQualityAcceptable: false,
      marketDisagreementExtreme: false,
      lineupUncertaintyAcceptable: true
    });

    expect(result).toEqual({
      decision: "NO_BET",
      reasons: ["DATA_QUALITY_UNACCEPTABLE"]
    });
  });

  test("returns no bet when market disagreement is extreme", () => {
    const result = evaluateNoBet({
      ev: 0.12,
      hasOdds: true,
      dataQualityAcceptable: true,
      marketDisagreementExtreme: true,
      lineupUncertaintyAcceptable: true
    });

    expect(result).toEqual({
      decision: "NO_BET",
      reasons: ["MARKET_DISAGREEMENT_EXTREME"]
    });
  });

  test("returns no bet when odds are missing", () => {
    const result = evaluateNoBet({
      ev: null,
      hasOdds: false,
      dataQualityAcceptable: true,
      marketDisagreementExtreme: false,
      lineupUncertaintyAcceptable: true
    });

    expect(result).toEqual({
      decision: "NO_BET",
      reasons: ["MISSING_ODDS"]
    });
  });
});
