const { calculateEv, evaluateEv } = require("../src/services/evEngine");

describe("EV engine", () => {
  test("signals when EV is above five percent and all no-bet gates pass", () => {
    const result = evaluateEv({
      modelProbability: 0.55,
      odds: 2,
      dataQualityAcceptable: true,
      marketDisagreementExtreme: false,
      lineupUncertaintyAcceptable: true
    });

    expect(result).toEqual({
      decision: "SIGNAL",
      ev: 0.1,
      reasons: []
    });
  });

  test("returns no bet when EV is negative", () => {
    const result = evaluateEv({
      modelProbability: 0.45,
      odds: 2,
      dataQualityAcceptable: true,
      marketDisagreementExtreme: false,
      lineupUncertaintyAcceptable: true
    });

    expect(result).toEqual({
      decision: "NO_BET",
      ev: -0.1,
      reasons: ["EV_NOT_ABOVE_THRESHOLD"]
    });
  });

  test("calculates EV from model probability and decimal odds", () => {
    expect(calculateEv({ modelProbability: 0.55, odds: 2 })).toBe(0.1);
  });
});
