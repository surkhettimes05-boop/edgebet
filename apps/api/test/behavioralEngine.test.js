const { generateBehavioralSignals } = require("../src/services/behavioralEngine");

describe("behavioral engine", () => {
  test("flags stake escalation when stake increases more than forty percent from the previous bet", () => {
    const signals = generateBehavioralSignals({
      bets: [
        bet({ id: "b1", stakeUnits: 1, placedAt: "2026-05-22T10:00:00Z" }),
        bet({ id: "b2", stakeUnits: 1.41, placedAt: "2026-05-22T11:00:00Z" })
      ]
    });

    expect(signals).toContainEqual({
      signalType: "STAKE_ESCALATION",
      trackedBetId: "b2",
      severity: 1,
      metadata: {
        previousStakeUnits: 1,
        currentStakeUnits: 1.41,
        increasePct: 0.41
      }
    });
  });

  test("flags rapid betting when consecutive bets are placed less than ten minutes apart", () => {
    const signals = generateBehavioralSignals({
      bets: [
        bet({ id: "b1", placedAt: "2026-05-22T10:00:00Z" }),
        bet({ id: "b2", placedAt: "2026-05-22T10:09:00Z" })
      ]
    });

    expect(signals).toContainEqual({
      signalType: "RAPID_BETTING",
      trackedBetId: "b2",
      severity: 1,
      metadata: {
        previousBetId: "b1",
        minutesSincePreviousBet: 9
      }
    });
  });

  test("flags loss chasing when stake increases more than forty percent within three bets after consecutive losses", () => {
    const signals = generateBehavioralSignals({
      bets: [
        bet({ id: "b1", stakeUnits: 1, status: "LOST", placedAt: "2026-05-22T10:00:00Z" }),
        bet({ id: "b2", stakeUnits: 1, status: "LOST", placedAt: "2026-05-22T11:00:00Z" }),
        bet({ id: "b3", stakeUnits: 1.45, status: "TRACKED", placedAt: "2026-05-22T12:00:00Z" })
      ]
    });

    expect(signals).toContainEqual({
      signalType: "LOSS_CHASING",
      trackedBetId: "b3",
      severity: 2,
      metadata: {
        previousStakeUnits: 1,
        currentStakeUnits: 1.45,
        increasePct: 0.45,
        betsAfterLossStreak: 1
      }
    });
  });

  test("flags emotional escalation when frequency increases more than sixty percent during a negative ROI streak", () => {
    const signals = generateBehavioralSignals({
      bets: [
        bet({ id: "b1", status: "WON", placedAt: "2026-05-22T10:00:00Z", realizedReturn: 1 }),
        bet({ id: "b2", status: "WON", placedAt: "2026-05-22T12:00:00Z", realizedReturn: 1 }),
        bet({ id: "b3", status: "LOST", placedAt: "2026-05-22T14:00:00Z", realizedReturn: -1 }),
        bet({ id: "b4", status: "LOST", placedAt: "2026-05-22T14:30:00Z", realizedReturn: -1 }),
        bet({ id: "b5", status: "LOST", placedAt: "2026-05-22T15:00:00Z", realizedReturn: -1 })
      ]
    });

    expect(signals).toContainEqual({
      signalType: "EMOTIONAL_ESCALATION",
      trackedBetId: "b5",
      severity: 2,
      metadata: {
        baselineIntervalMinutes: 120,
        streakIntervalMinutes: 30,
        frequencyIncreasePct: 3
      }
    });
  });

  test("flags override risk and no bet violations when no bet recommendations are repeatedly ignored", () => {
    const signals = generateBehavioralSignals({
      bets: [
        bet({ id: "b1", placedAt: "2026-05-22T10:00:00Z", noBetRecommended: true, placedAgainstRecommendation: true }),
        bet({ id: "b2", placedAt: "2026-05-22T11:00:00Z", noBetRecommended: true, placedAgainstRecommendation: true }),
        bet({ id: "b3", placedAt: "2026-05-22T12:00:00Z", noBetRecommended: true, placedAgainstRecommendation: true })
      ]
    });

    expect(signals.map((signal) => signal.signalType)).toEqual([
      "NO_BET_VIOLATION",
      "NO_BET_VIOLATION",
      "NO_BET_VIOLATION",
      "OVERRIDE_RISK"
    ]);
  });
});

function bet(overrides) {
  return {
    id: overrides.id,
    stakeUnits: overrides.stakeUnits || 1,
    status: overrides.status || "TRACKED",
    placedAt: overrides.placedAt || "2026-05-22T10:00:00Z",
    realizedReturn: overrides.realizedReturn,
    noBetRecommended: overrides.noBetRecommended || false,
    placedAgainstRecommendation: overrides.placedAgainstRecommendation || false
  };
}
