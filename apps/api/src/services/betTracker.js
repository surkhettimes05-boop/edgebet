/**
 * betTracker.js
 * Core service for bet lifecycle management.
 * Handles EV at entry, CLV calculation, P&L, and summary stats.
 * All monetary values are in stake units (u).
 */

const { calculateEv } = require("./evEngine");
const { calculateClvProbDelta } = require("./clvEngine");
const { americanToDecimal } = require("../utils/oddsToProbability");

// ─── EV at Entry ──────────────────────────────────────────────────────────────

/**
 * Compute EV at entry given a model fair probability and decimal entry odds.
 * Returns null if either input is missing.
 */
function computeEvAtEntry({ modelFairProbability, entryPriceDecimal }) {
  if (
    modelFairProbability == null ||
    entryPriceDecimal == null ||
    !Number.isFinite(Number(modelFairProbability)) ||
    !Number.isFinite(Number(entryPriceDecimal))
  ) {
    return null;
  }

  return calculateEv({
    modelProbability: Number(modelFairProbability),
    odds: Number(entryPriceDecimal)
  });
}

// ─── CLV ──────────────────────────────────────────────────────────────────────

/**
 * Compute CLV% given entry decimal price and closing decimal price.
 * Returns null if closing price is not yet available.
 */
function computeClvPct({ entryPriceDecimal, closingPriceDecimal }) {
  if (
    closingPriceDecimal == null ||
    !Number.isFinite(Number(closingPriceDecimal)) ||
    Number(closingPriceDecimal) <= 0
  ) {
    return null;
  }

  return calculateClvProbDelta(
    Number(entryPriceDecimal),
    Number(closingPriceDecimal)
  );
}

// ─── P&L ──────────────────────────────────────────────────────────────────────

/**
 * Compute net P&L in stake units.
 * WON:  profit = stake * (decimalOdds - 1)
 * LOST: profit = -stake
 * PUSH: profit = 0
 * VOID: profit = 0
 * TRACKED/PLACED: profit = null (unresolved)
 */
function computePnl({ status, stakeUnits, priceDecimal }) {
  const stake = Number(stakeUnits);
  const odds = Number(priceDecimal);

  switch (status) {
    case "WON":
      return roundDecimal(stake * (odds - 1), 4);
    case "LOST":
      return roundDecimal(-stake, 4);
    case "PUSH":
    case "VOID":
      return 0;
    default:
      return null;
  }
}

// ─── Summary Stats ────────────────────────────────────────────────────────────

/**
 * Compute aggregate stats from an array of TrackedBet records.
 * Each bet should have: status, stakeUnits, priceDecimal, clvPct (optional).
 */
function computeSummaryStats(bets) {
  const resolved = bets.filter((b) =>
    ["WON", "LOST", "PUSH", "VOID"].includes(b.status)
  );
  const won = resolved.filter((b) => b.status === "WON");
  const lost = resolved.filter((b) => b.status === "LOST");

  const totalBets = bets.length;
  const resolvedCount = resolved.length;
  const winCount = won.length;
  const winRate = resolvedCount > 0 ? winCount / resolvedCount : null;

  const totalStaked = bets.reduce((sum, b) => sum + Number(b.stakeUnits), 0);

  const netPnl = resolved.reduce((sum, b) => {
    const pnl = computePnl({
      status: b.status,
      stakeUnits: b.stakeUnits,
      priceDecimal: b.priceDecimal
    });
    return sum + (pnl ?? 0);
  }, 0);

  const roi = totalStaked > 0 ? netPnl / totalStaked : null;

  // Average CLV across bets that have a closing price recorded
  const betsWithClv = bets.filter(
    (b) => b.clvPct != null && Number.isFinite(Number(b.clvPct))
  );
  const avgClvPct =
    betsWithClv.length > 0
      ? betsWithClv.reduce((sum, b) => sum + Number(b.clvPct), 0) /
        betsWithClv.length
      : null;

  return {
    totalBets,
    resolvedCount,
    winCount,
    lossCount: lost.length,
    winRate: winRate != null ? roundDecimal(winRate, 4) : null,
    totalStaked: roundDecimal(totalStaked, 4),
    netPnl: roundDecimal(netPnl, 4),
    roi: roi != null ? roundDecimal(roi, 4) : null,
    avgClvPct: avgClvPct != null ? roundDecimal(avgClvPct, 4) : null,
    clvSampleSize: betsWithClv.length
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundDecimal(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * Convert American odds to decimal if decimal not provided.
 */
function resolveDecimalPrice(priceDecimal, priceAmerican) {
  if (priceDecimal != null && Number.isFinite(Number(priceDecimal))) {
    return Number(priceDecimal);
  }
  if (priceAmerican != null && Number.isFinite(Number(priceAmerican))) {
    return americanToDecimal(Number(priceAmerican));
  }
  return null;
}

module.exports = {
  computeEvAtEntry,
  computeClvPct,
  computePnl,
  computeSummaryStats,
  resolveDecimalPrice
};
