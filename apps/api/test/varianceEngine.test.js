const { evaluateVarianceState, VARIANCE_NOTICE_MESSAGE } = require("../src/services/varianceEngine");

describe("variance engine", () => {
  test("shows deterministic variance notice when CLV is positive, discipline is stable, and ROI is temporarily negative", () => {
    const evaluation = evaluateVarianceState({
      averageClvPct: 0.032,
      roiPct: -0.06,
      totalBets: 80,
      resolvedBets: 72,
      overrideRate: 0.04,
      behavioralSignals: [
        { signalType: "NO_BET_VIOLATION", severity: 1 }
      ]
    });

    expect(evaluation).toEqual({
      shouldDisplay: true,
      code: "EXPECTED_VARIANCE_DISCIPLINE_STABLE",
      severity: "info",
      message: VARIANCE_NOTICE_MESSAGE,
      reasons: {
        clvPositive: true,
        disciplineStable: true,
        roiTemporarilyNegative: true,
        sampleSufficient: true,
        withinVarianceRange: true
      }
    });
  });

  test("does not show the notice when CLV is not positive", () => {
    const evaluation = evaluateVarianceState(validVarianceInputs({ averageClvPct: 0 }));

    expect(evaluation.shouldDisplay).toBe(false);
    expect(evaluation.reasons.clvPositive).toBe(false);
  });

  test("does not show the notice when discipline is degraded", () => {
    const evaluation = evaluateVarianceState(validVarianceInputs({
      overrideRate: 0.13,
      behavioralSignals: [
        { signalType: "LOSS_CHASING", severity: 2 }
      ]
    }));

    expect(evaluation.shouldDisplay).toBe(false);
    expect(evaluation.reasons.disciplineStable).toBe(false);
  });

  test("does not show the notice when ROI is positive or beyond the variance range", () => {
    const positiveRoi = evaluateVarianceState(validVarianceInputs({ roiPct: 0.01 }));
    const outsideVarianceRange = evaluateVarianceState(validVarianceInputs({ roiPct: -0.26 }));

    expect(positiveRoi.shouldDisplay).toBe(false);
    expect(positiveRoi.reasons.roiTemporarilyNegative).toBe(false);
    expect(outsideVarianceRange.shouldDisplay).toBe(false);
    expect(outsideVarianceRange.reasons.withinVarianceRange).toBe(false);
  });

  test("does not show the notice when sample size is insufficient", () => {
    const evaluation = evaluateVarianceState(validVarianceInputs({
      totalBets: 24,
      resolvedBets: 22
    }));

    expect(evaluation.shouldDisplay).toBe(false);
    expect(evaluation.reasons.sampleSufficient).toBe(false);
  });
});

function validVarianceInputs(overrides = {}) {
  return {
    averageClvPct: 0.025,
    roiPct: -0.05,
    totalBets: 80,
    resolvedBets: 72,
    overrideRate: 0.04,
    behavioralSignals: [],
    ...overrides
  };
}
