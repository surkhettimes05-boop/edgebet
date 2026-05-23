/**
 * oddsToProbability.js
 *
 * Deterministic conversions between odds formats and implied probabilities.
 * All functions are pure — no side effects, no randomness.
 *
 * CLV formula used throughout EdgeBet:
 *   CLV (prob delta) = impliedProbAtEntry - impliedProbAtClose
 *
 * A positive delta means the market moved against you (closing line is
 * shorter / more confident than your entry), confirming you had an edge.
 * A negative delta means the market moved in your favour — you got worse
 * than closing.
 *
 * Secondary metric (odds ratio):
 *   CLV (odds ratio) = entryDecimal / closingDecimal - 1
 * Positive = entry odds were longer than close (edge confirmed).
 */

// ─── Decimal ↔ Implied Probability ───────────────────────────────────────────

/**
 * Convert decimal odds to raw implied probability.
 * No vig removal — this is the bookmaker's raw implied probability.
 *
 * @param {number} decimal  e.g. 2.10
 * @returns {number}        e.g. 0.476190
 */
function decimalToImpliedProb(decimal) {
  assertDecimalOdds(decimal, "decimal");
  return roundDecimal(1 / decimal, 8);
}

/**
 * Convert implied probability to decimal odds.
 *
 * @param {number} prob  e.g. 0.52
 * @returns {number}     e.g. 1.923077
 */
function impliedProbToDecimal(prob) {
  assertProbability(prob, "prob");
  return roundDecimal(1 / prob, 6);
}

// ─── American ↔ Implied Probability ──────────────────────────────────────────

/**
 * Convert American odds to raw implied probability.
 *
 * @param {number} american  e.g. -110, +150
 * @returns {number}         e.g. 0.523810
 */
function americanToImpliedProb(american) {
  assertAmericanOdds(american, "american");
  if (american > 0) {
    return roundDecimal(100 / (american + 100), 8);
  }
  return roundDecimal(Math.abs(american) / (Math.abs(american) + 100), 8);
}

/**
 * Convert American odds to decimal odds.
 *
 * @param {number} american  e.g. -110
 * @returns {number}         e.g. 1.909091
 */
function americanToDecimal(american) {
  assertAmericanOdds(american, "american");
  if (american > 0) {
    return roundDecimal(american / 100 + 1, 6);
  }
  return roundDecimal(100 / Math.abs(american) + 1, 6);
}

/**
 * Convert decimal odds to American odds.
 *
 * @param {number} decimal  e.g. 2.50
 * @returns {number}        e.g. 150
 */
function decimalToAmerican(decimal) {
  assertDecimalOdds(decimal, "decimal");
  if (decimal >= 2.0) {
    return Math.round((decimal - 1) * 100);
  }
  return Math.round(-100 / (decimal - 1));
}

// ─── Vig Removal (Shin / Equal-Vig) ──────────────────────────────────────────

/**
 * Remove bookmaker vig from a two-outcome market using the equal-vig method.
 * Returns fair (no-vig) probabilities that sum to 1.
 *
 * @param {number} impliedProbA  Raw implied prob for outcome A
 * @param {number} impliedProbB  Raw implied prob for outcome B
 * @returns {{ fairA: number, fairB: number, margin: number }}
 */
function removeVigEqualWeight(impliedProbA, impliedProbB) {
  assertProbability(impliedProbA, "impliedProbA");
  assertProbability(impliedProbB, "impliedProbB");

  const total = impliedProbA + impliedProbB;
  if (total <= 0) throw new Error("Sum of implied probabilities must be positive.");

  const margin = roundDecimal(total - 1, 8);
  const fairA = roundDecimal(impliedProbA / total, 8);
  const fairB = roundDecimal(impliedProbB / total, 8);

  return { fairA, fairB, margin };
}

/**
 * Remove vig from an N-outcome market using the equal-vig method.
 * Returns an array of fair probabilities in the same order as inputs.
 *
 * @param {number[]} impliedProbs  Array of raw implied probabilities
 * @returns {{ fairProbs: number[], margin: number }}
 */
function removeVigEqualWeightN(impliedProbs) {
  if (!Array.isArray(impliedProbs) || impliedProbs.length === 0) {
    throw new Error("impliedProbs must be a non-empty array.");
  }
  impliedProbs.forEach((p, i) => assertProbability(p, `impliedProbs[${i}]`));

  const total = impliedProbs.reduce((s, p) => s + p, 0);
  const margin = roundDecimal(total - 1, 8);
  const fairProbs = impliedProbs.map((p) => roundDecimal(p / total, 8));

  return { fairProbs, margin };
}

// ─── CLV Calculations ─────────────────────────────────────────────────────────

/**
 * Calculate CLV as a probability delta.
 *
 *   clvProbDelta = impliedProbAtEntry - impliedProbAtClose
 *
 * Positive value = entry implied prob was LOWER than closing implied prob,
 * meaning the market shortened (became more confident) after your bet —
 * you beat the closing line.
 *
 * @param {number} entryDecimal    Decimal odds at time of bet
 * @param {number} closingDecimal  Decimal odds at market close
 * @returns {{
 *   entryImpliedProb: number,
 *   closingImpliedProb: number,
 *   clvProbDelta: number,
 *   clvOddsRatio: number,
 *   beatingClosingLine: boolean
 * }}
 */
function calculateClvFull({ entryDecimal, closingDecimal }) {
  assertDecimalOdds(entryDecimal, "entryDecimal");
  assertDecimalOdds(closingDecimal, "closingDecimal");

  const entryImpliedProb = decimalToImpliedProb(entryDecimal);
  const closingImpliedProb = decimalToImpliedProb(closingDecimal);

  // Probability delta: positive = you beat the closing line
  const clvProbDelta = roundDecimal(closingImpliedProb - entryImpliedProb, 8);

  // Odds ratio: positive = entry odds were longer than close (edge confirmed)
  const clvOddsRatio = roundDecimal(entryDecimal / closingDecimal - 1, 8);

  return {
    entryImpliedProb,
    closingImpliedProb,
    clvProbDelta,
    clvOddsRatio,
    beatingClosingLine: clvProbDelta > 0
  };
}

/**
 * Calculate CLV probability delta only (lightweight version).
 *
 * @param {number} entryDecimal
 * @param {number} closingDecimal
 * @returns {number}  Probability delta (positive = beat closing line)
 */
function clvProbDelta(entryDecimal, closingDecimal) {
  return calculateClvFull({ entryDecimal, closingDecimal }).clvProbDelta;
}

/**
 * Calculate CLV odds ratio only (legacy / secondary metric).
 *
 * @param {number} entryDecimal
 * @param {number} closingDecimal
 * @returns {number}  Odds ratio (positive = entry odds longer than close)
 */
function clvOddsRatio(entryDecimal, closingDecimal) {
  assertDecimalOdds(entryDecimal, "entryDecimal");
  assertDecimalOdds(closingDecimal, "closingDecimal");
  return roundDecimal(entryDecimal / closingDecimal - 1, 8);
}

// ─── Bookmaker Margin ─────────────────────────────────────────────────────────

/**
 * Calculate bookmaker margin (overround) from an array of decimal odds.
 *
 * @param {number[]} decimalOdds  e.g. [2.10, 1.80] for a two-way market
 * @returns {number}              Margin as a fraction, e.g. 0.0476
 */
function bookmakerMarginFromDecimals(decimalOdds) {
  if (!Array.isArray(decimalOdds) || decimalOdds.length === 0) {
    throw new Error("decimalOdds must be a non-empty array.");
  }
  decimalOdds.forEach((d, i) => assertDecimalOdds(d, `decimalOdds[${i}]`));

  const totalImplied = decimalOdds.reduce((sum, d) => sum + 1 / d, 0);
  return roundDecimal(Math.max(totalImplied - 1, 0), 8);
}

// ─── Assertions ───────────────────────────────────────────────────────────────

function assertDecimalOdds(value, label) {
  if (!Number.isFinite(value) || value <= 1) {
    throw new Error(`${label} must be a finite number greater than 1.0 (got ${value}).`);
  }
}

function assertAmericanOdds(value, label) {
  if (!Number.isFinite(value) || value === 0) {
    throw new Error(`${label} must be a non-zero finite number (got ${value}).`);
  }
}

function assertProbability(value, label) {
  if (!Number.isFinite(value) || value <= 0 || value >= 1) {
    throw new Error(`${label} must be a number strictly between 0 and 1 (got ${value}).`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundDecimal(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

module.exports = {
  // Core conversions
  decimalToImpliedProb,
  impliedProbToDecimal,
  americanToImpliedProb,
  americanToDecimal,
  decimalToAmerican,
  // Vig removal
  removeVigEqualWeight,
  removeVigEqualWeightN,
  // CLV
  calculateClvFull,
  clvProbDelta,
  clvOddsRatio,
  // Margin
  bookmakerMarginFromDecimals
};
