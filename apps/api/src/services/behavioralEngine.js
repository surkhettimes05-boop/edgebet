const STAKE_ESCALATION_THRESHOLD = 0.4;
const RAPID_BETTING_MINUTES = 10;
const OVERRIDE_RISK_COUNT = 3;
const NEGATIVE_STREAK_LENGTH = 3;
const FREQUENCY_INCREASE_THRESHOLD = 0.6;

function generateBehavioralSignals({ bets }) {
  const orderedBets = normalizeBets(bets);
  const signals = [];

  signals.push(...detectStakeEscalation(orderedBets));
  signals.push(...detectRapidBetting(orderedBets));
  signals.push(...detectLossChasing(orderedBets));
  signals.push(...detectEmotionalEscalation(orderedBets));
  signals.push(...detectNoBetViolations(orderedBets));

  return signals;
}

function detectStakeEscalation(bets) {
  const signals = [];

  for (let index = 1; index < bets.length; index += 1) {
    const previous = bets[index - 1];
    const current = bets[index];
    const increasePct = percentageIncrease(previous.stakeUnits, current.stakeUnits);

    if (increasePct > STAKE_ESCALATION_THRESHOLD) {
      signals.push(signal("STAKE_ESCALATION", current.id, 1, {
        previousStakeUnits: previous.stakeUnits,
        currentStakeUnits: current.stakeUnits,
        increasePct
      }));
    }
  }

  return signals;
}

function detectRapidBetting(bets) {
  const signals = [];

  for (let index = 1; index < bets.length; index += 1) {
    const previous = bets[index - 1];
    const current = bets[index];
    const minutesSincePreviousBet = minutesBetween(previous.placedAt, current.placedAt);

    if (Number.isFinite(minutesSincePreviousBet) && minutesSincePreviousBet < RAPID_BETTING_MINUTES) {
      signals.push(signal("RAPID_BETTING", current.id, 1, {
        previousBetId: previous.id,
        minutesSincePreviousBet
      }));
    }
  }

  return signals;
}

function detectLossChasing(bets) {
  const signals = [];

  for (let index = 1; index < bets.length; index += 1) {
    if (!isLoss(bets[index - 1]) || !isLoss(bets[index])) {
      continue;
    }

    const lastLoss = bets[index];
    for (let offset = 1; offset <= 3 && index + offset < bets.length; offset += 1) {
      const candidate = bets[index + offset];
      const increasePct = percentageIncrease(lastLoss.stakeUnits, candidate.stakeUnits);

      if (increasePct > STAKE_ESCALATION_THRESHOLD) {
        signals.push(signal("LOSS_CHASING", candidate.id, 2, {
          previousStakeUnits: lastLoss.stakeUnits,
          currentStakeUnits: candidate.stakeUnits,
          increasePct,
          betsAfterLossStreak: offset
        }));
        break;
      }
    }
  }

  return signals;
}

function detectEmotionalEscalation(bets) {
  const negativeStart = bets.findIndex((bet, index) => {
    return index <= bets.length - NEGATIVE_STREAK_LENGTH
      && bets.slice(index, index + NEGATIVE_STREAK_LENGTH).every(isNegativeRoi);
  });

  if (negativeStart <= 0) {
    return [];
  }

  const negativeStreak = bets.slice(negativeStart, negativeStart + NEGATIVE_STREAK_LENGTH);
  const baseline = bets.slice(0, negativeStart + 1);
  const baselineIntervalMinutes = averageIntervalMinutes(baseline);
  const streakIntervalMinutes = averageIntervalMinutes(negativeStreak);

  if (!Number.isFinite(baselineIntervalMinutes) || !Number.isFinite(streakIntervalMinutes) || streakIntervalMinutes === 0) {
    return [];
  }

  const frequencyIncreasePct = roundDecimal(baselineIntervalMinutes / streakIntervalMinutes - 1, 6);

  if (frequencyIncreasePct <= FREQUENCY_INCREASE_THRESHOLD) {
    return [];
  }

  return [
    signal("EMOTIONAL_ESCALATION", negativeStreak[negativeStreak.length - 1].id, 2, {
      baselineIntervalMinutes,
      streakIntervalMinutes,
      frequencyIncreasePct
    })
  ];
}

function detectNoBetViolations(bets) {
  const violations = bets.filter((bet) => bet.noBetRecommended === true && bet.placedAgainstRecommendation === true);
  const signals = violations.map((bet) => signal("NO_BET_VIOLATION", bet.id, 1, {
    noBetRecommended: true,
    placedAgainstRecommendation: true
  }));

  if (violations.length >= OVERRIDE_RISK_COUNT) {
    signals.push(signal("OVERRIDE_RISK", violations[violations.length - 1].id, 2, {
      overrideCount: violations.length,
      threshold: OVERRIDE_RISK_COUNT
    }));
  }

  return signals;
}

function normalizeBets(bets) {
  if (!Array.isArray(bets)) {
    return [];
  }

  return bets
    .map((bet) => ({
      ...bet,
      stakeUnits: toNumber(bet.stakeUnits),
      placedAt: bet.placedAt ? new Date(bet.placedAt) : null,
      realizedReturn: bet.realizedReturn === undefined ? null : toNumber(bet.realizedReturn)
    }))
    .sort((a, b) => {
      const aTime = a.placedAt instanceof Date ? a.placedAt.getTime() : 0;
      const bTime = b.placedAt instanceof Date ? b.placedAt.getTime() : 0;
      return aTime - bTime;
    });
}

function signal(signalType, trackedBetId, severity, metadata) {
  return {
    signalType,
    trackedBetId,
    severity,
    metadata
  };
}

function isLoss(bet) {
  return bet.status === "LOST";
}

function isNegativeRoi(bet) {
  return bet.realizedReturn < 0 || isLoss(bet);
}

function percentageIncrease(previousValue, currentValue) {
  if (!Number.isFinite(previousValue) || previousValue <= 0 || !Number.isFinite(currentValue)) {
    return 0;
  }

  return roundDecimal(currentValue / previousValue - 1, 6);
}

function averageIntervalMinutes(bets) {
  if (bets.length < 2) {
    return null;
  }

  const intervals = [];
  for (let index = 1; index < bets.length; index += 1) {
    intervals.push(minutesBetween(bets[index - 1].placedAt, bets[index].placedAt));
  }

  const validIntervals = intervals.filter(Number.isFinite);
  if (validIntervals.length === 0) {
    return null;
  }

  return roundDecimal(validIntervals.reduce((sum, interval) => sum + interval, 0) / validIntervals.length, 6);
}

function minutesBetween(start, end) {
  if (!(start instanceof Date) || !(end instanceof Date)) {
    return null;
  }

  return roundDecimal((end.getTime() - start.getTime()) / 60000, 6);
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
  generateBehavioralSignals
};
