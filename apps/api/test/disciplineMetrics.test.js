const { summarizeDiscipline } = require("../src/services/disciplineMetrics");

describe("discipline metrics", () => {
  test("generates discipline summaries from bets, behavioral signals, and CLV records", () => {
    const summary = summarizeDiscipline({
      bets: [
        { id: "b1", stakeUnits: 1, noBetRecommended: true, placedAgainstRecommendation: true },
        { id: "b2", stakeUnits: 2, noBetRecommended: false, placedAgainstRecommendation: false }
      ],
      behavioralSignals: [
        { signalType: "NO_BET_VIOLATION" },
        { signalType: "STAKE_ESCALATION" }
      ],
      clvRecords: [
        { clvPct: 0.05 },
        { clvPct: -0.02 }
      ]
    });

    expect(summary).toEqual({
      totalBets: 2,
      totalStakeUnits: 3,
      noBetViolations: 1,
      overrideRate: 0.5,
      signalCounts: {
        NO_BET_VIOLATION: 1,
        STAKE_ESCALATION: 1
      },
      averageClvPct: 0.015
    });
  });
});
