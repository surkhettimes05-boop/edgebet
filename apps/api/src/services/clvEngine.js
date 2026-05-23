/**
 * clvEngine.js
 *
 * Closing Line Value calculation service.
 *
 * Primary CLV metric (per EdgeBet spec):
 *   CLV (prob delta) = impliedProbAtClose - impliedProbAtEntry
 *
 * A positive value means the market's implied probability at close was
 * HIGHER than at your entry — the line shortened after you bet, confirming
 * you captured value relative to the closing line.
 *
 * Secondary metric (odds ratio, stored for historical reference):
 *   CLV (odds ratio) = entryDecimal / closingDecimal - 1
 *
 * All calculations are deterministic. No synthetic scores.
 * All historical snapshots are preserved — never overwritten.
 */

const {
  calculateClvFull,
  clvProbDelta,
  clvOddsRatio,
  decimalToImpliedProb,
  americanToDecimal
} = require("../utils/oddsToProbability");

// ─── Core CLV calculation ─────────────────────────────────────────────────────

/**
 * Full CLV breakdown for a single bet.
 *
 * @param {{ entryDecimal: number, closingDecimal: number }} params
 * @returns {{
 *   entryImpliedProb: number,
 *   closingImpliedProb: number,
 *   clvProbDelta: number,       ← PRIMARY metric (prob delta)
 *   clvOddsRatio: number,       ← secondary metric
 *   beatingClosingLine: boolean
 * }}
 */
function calculateClv({ entryDecimal, closingDecimal, entryPrice, closingPrice }) {
  // Accept both new-style (entryDecimal/closingDecimal) and legacy (entryPrice/closingPrice)
  const entry = entryDecimal ?? entryPrice;
  const closing = closingDecimal ?? closingPrice;
  return calculateClvFull({ entryDecimal: entry, closingDecimal: closing });
}

/**
 * Lightweight: probability delta only.
 * Positive = beat the closing line.
 *
 * @param {number} entryDecimal
 * @param {number} closingDecimal
 * @returns {number}
 */
function calculateClvProbDelta(entryDecimal, closingDecimal) {
  return clvProbDelta(entryDecimal, closingDecimal);
}

/**
 * Lightweight: odds ratio only (legacy / secondary).
 *
 * @param {number} entryDecimal
 * @param {number} closingDecimal
 * @returns {number}
 */
function calculateClvOddsRatio(entryDecimal, closingDecimal) {
  return clvOddsRatio(entryDecimal, closingDecimal);
}

// ─── CLV History record builder ───────────────────────────────────────────────

/**
 * Build a ClvHistory record payload (ready for Prisma insert).
 * Preserves all snapshot data — never mutates existing records.
 *
 * @param {{
 *   trackedBetId: string,
 *   oddsSnapshotId?: string | null,
 *   entryDecimal: number,
 *   closingDecimal: number,
 *   measuredAt?: Date
 * }} params
 * @returns {{
 *   trackedBetId: string,
 *   oddsSnapshotId: string | null,
 *   entryPrice: number,
 *   closingPrice: number,
 *   clvPct: number,             ← probability delta (primary)
 *   clvOddsRatio: number,       ← odds ratio (secondary)
 *   entryImpliedProb: number,
 *   closingImpliedProb: number,
 *   beatingClosingLine: boolean,
 *   measuredAt: Date
 * }}
 */
function buildClvRecord({
  trackedBetId,
  oddsSnapshotId = null,
  entryDecimal,
  closingDecimal,
  measuredAt = new Date()
}) {
  const result = calculateClvFull({ entryDecimal, closingDecimal });

  return {
    trackedBetId,
    oddsSnapshotId,
    entryPrice: entryDecimal,
    closingPrice: closingDecimal,
    // clvPct stored as probability delta (primary metric)
    clvPct: result.clvProbDelta,
    clvOddsRatio: result.clvOddsRatio,
    entryImpliedProb: result.entryImpliedProb,
    closingImpliedProb: result.closingImpliedProb,
    beatingClosingLine: result.beatingClosingLine,
    measuredAt
  };
}

// ─── Aggregate CLV stats ──────────────────────────────────────────────────────

/**
 * Compute aggregate CLV statistics from an array of ClvHistory records.
 * Each record must have: clvPct (prob delta), clvOddsRatio, entryPrice,
 * closingPrice, measuredAt.
 *
 * @param {Array<{
 *   clvPct: number,
 *   clvOddsRatio?: number,
 *   entryPrice: number,
 *   closingPrice: number,
 *   measuredAt: string | Date
 * }>} records
 * @returns {{
 *   count: number,
 *   avgClvProbDelta: number | null,
 *   avgClvOddsRatio: number | null,
 *   positiveCount: number,
 *   negativeCount: number,
 *   positiveRate: number | null,
 *   maxClv: number | null,
 *   minClv: number | null,
 *   trend: Array<{ date: string, clvProbDelta: number, clvOddsRatio: number, cumAvg: number }>
 * }}
 */
function aggregateClvStats(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      count: 0,
      avgClvProbDelta: null,
      avgClvOddsRatio: null,
      positiveCount: 0,
      negativeCount: 0,
      positiveRate: null,
      maxClv: null,
      minClv: null,
      trend: []
    };
  }

  // Sort chronologically for trend calculation
  const sorted = [...records].sort(
    (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime()
  );

  const probDeltas = sorted.map((r) => Number(r.clvPct));
  const oddsRatios = sorted
    .filter((r) => r.clvOddsRatio != null)
    .map((r) => Number(r.clvOddsRatio));

  const count = probDeltas.length;
  const sum = probDeltas.reduce((s, v) => s + v, 0);
  const avgClvProbDelta = roundDecimal(sum / count, 6);
  const avgClvOddsRatio =
    oddsRatios.length > 0
      ? roundDecimal(oddsRatios.reduce((s, v) => s + v, 0) / oddsRatios.length, 6)
      : null;

  const positiveCount = probDeltas.filter((v) => v > 0).length;
  const negativeCount = probDeltas.filter((v) => v < 0).length;
  const positiveRate = roundDecimal(positiveCount / count, 4);

  const maxClv = roundDecimal(Math.max(...probDeltas), 6);
  const minClv = roundDecimal(Math.min(...probDeltas), 6);

  // Build trend: cumulative average CLV over time
  let runningSum = 0;
  const trend = sorted.map((r, i) => {
    runningSum += Number(r.clvPct);
    return {
      date: formatDate(r.measuredAt),
      clvProbDelta: roundDecimal(Number(r.clvPct), 6),
      clvOddsRatio: r.clvOddsRatio != null ? roundDecimal(Number(r.clvOddsRatio), 6) : null,
      cumAvg: roundDecimal(runningSum / (i + 1), 6)
    };
  });

  return {
    count,
    avgClvProbDelta,
    avgClvOddsRatio,
    positiveCount,
    negativeCount,
    positiveRate,
    maxClv,
    minClv,
    trend
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundDecimal(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function formatDate(value) {
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return String(value);
  }
}

// ─── Legacy shim ─────────────────────────────────────────────────────────────

/**
 * trackClv — backward-compatible shim.
 * Returns a plain record object with clvPct as the odds ratio,
 * matching the shape expected by existing tests and callers.
 *
 * @param {{ trackedBetId, oddsSnapshotId, entryPrice, closingPrice, measuredAt }}
 * @returns {{ trackedBetId, oddsSnapshotId, entryPrice, closingPrice, clvPct, measuredAt }}
 */
function trackClv({ trackedBetId, oddsSnapshotId, entryPrice, closingPrice, measuredAt }) {
  return {
    trackedBetId,
    oddsSnapshotId: oddsSnapshotId || null,
    entryPrice,
    closingPrice,
    clvPct: clvOddsRatio(entryPrice, closingPrice),
    measuredAt
  };
}

module.exports = {
  // ── New primary API ──
  calculateClv,              // full breakdown object
  calculateClvProbDelta,     // prob delta (primary metric)
  calculateClvOddsRatio,     // odds ratio (secondary metric)
  buildClvRecord,
  aggregateClvStats,
  // Re-export for convenience
  decimalToImpliedProb,
  // ── Legacy shims (backward compatibility with existing tests) ──
  trackClv
};
