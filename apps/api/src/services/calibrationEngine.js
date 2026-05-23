/**
 * calibrationEngine.js
 *
 * Deterministic calibration metrics for model probability tracking.
 *
 * Core concepts:
 *
 *   Brier Score = (1/N) Σ (predictedProb - outcome)²
 *     where outcome ∈ {0, 1}. Lower is better. Perfect = 0, random = 0.25.
 *
 *   Calibration = how closely predicted probabilities match observed win rates.
 *     A perfectly calibrated model: among all predictions of p=0.60, 60% win.
 *
 *   Reliability = mean squared deviation of bin win rate from bin midpoint.
 *     Lower = better calibrated.
 *
 *   Resolution = variance of bin win rates around the overall mean win rate.
 *     Higher = model is more discriminating.
 *
 *   Probability Drift = rolling mean of predicted probability over time,
 *     compared against rolling actual win rate. Divergence signals model decay.
 *
 * All functions are pure — no side effects, no I/O.
 */

// ─── Outcome encoding ─────────────────────────────────────────────────────────

/**
 * Convert OutcomeResult enum to binary outcome for Brier score.
 * WIN → 1, LOSS → 0, PUSH/UNRESOLVED → null (excluded from calculations).
 *
 * @param {"WIN"|"LOSS"|"PUSH"|"UNRESOLVED"} result
 * @returns {1|0|null}
 */
function outcomeToNumeric(result) {
  if (result === "WIN") return 1;
  if (result === "LOSS") return 0;
  return null; // PUSH and UNRESOLVED are excluded
}

// ─── Brier Score ──────────────────────────────────────────────────────────────

/**
 * Brier score for a single prediction.
 *
 * @param {number} predictedProb  Model probability (0–1)
 * @param {1|0}    outcome        Binary outcome
 * @returns {number}
 */
function brierScore(predictedProb, outcome) {
  assertProbability(predictedProb, "predictedProb");
  assertBinaryOutcome(outcome, "outcome");
  return roundDecimal((predictedProb - outcome) ** 2, 8);
}

/**
 * Mean Brier score across N resolved predictions.
 *
 * @param {Array<{ predictedProbability: number, result: string }>} records
 * @returns {{ score: number, count: number } | null}
 */
function brierScoreMulti(records) {
  const resolved = records.filter((r) => {
    const o = outcomeToNumeric(r.result);
    return o !== null && Number.isFinite(Number(r.predictedProbability));
  });

  if (resolved.length === 0) return null;

  const sum = resolved.reduce((acc, r) => {
    const prob = Number(r.predictedProbability);
    const outcome = outcomeToNumeric(r.result);
    return acc + (prob - outcome) ** 2;
  }, 0);

  return {
    score: roundDecimal(sum / resolved.length, 6),
    count: resolved.length
  };
}

// ─── Calibration bins ─────────────────────────────────────────────────────────

/**
 * Group predictions into probability bins and compute actual win rate per bin.
 * Used to draw the calibration chart (predicted prob vs actual win rate).
 *
 * @param {Array<{ predictedProbability: number, result: string }>} records
 * @param {number} [binCount=10]  Number of equal-width bins across [0, 1]
 * @returns {Array<{
 *   binMidpoint: number,
 *   binLow: number,
 *   binHigh: number,
 *   predictedMean: number,
 *   actualWinRate: number | null,
 *   count: number,
 *   brierScore: number | null
 * }>}
 */
function buildCalibrationBins(records, binCount = 10) {
  if (!Array.isArray(records) || records.length === 0) return [];

  const binWidth = 1 / binCount;
  const bins = [];

  for (let i = 0; i < binCount; i++) {
    const lo = i * binWidth;
    const hi = lo + binWidth;
    const mid = roundDecimal(lo + binWidth / 2, 4);

    const inBin = records.filter((r) => {
      const p = Number(r.predictedProbability);
      return (
        Number.isFinite(p) &&
        p >= lo &&
        (i === binCount - 1 ? p <= hi : p < hi)
      );
    });

    const resolved = inBin.filter((r) => outcomeToNumeric(r.result) !== null);
    const wins = resolved.filter((r) => r.result === "WIN").length;

    const actualWinRate =
      resolved.length > 0 ? roundDecimal(wins / resolved.length, 6) : null;

    const predictedMean =
      inBin.length > 0
        ? roundDecimal(
            inBin.reduce((s, r) => s + Number(r.predictedProbability), 0) / inBin.length,
            6
          )
        : mid;

    const binBrier =
      resolved.length > 0
        ? roundDecimal(
            resolved.reduce((s, r) => {
              const o = outcomeToNumeric(r.result);
              return s + (Number(r.predictedProbability) - o) ** 2;
            }, 0) / resolved.length,
            6
          )
        : null;

    bins.push({
      binMidpoint: mid,
      binLow: roundDecimal(lo, 4),
      binHigh: roundDecimal(hi, 4),
      predictedMean,
      actualWinRate,
      count: inBin.length,
      resolvedCount: resolved.length,
      brierScore: binBrier
    });
  }

  return bins;
}

// ─── Probability drift ────────────────────────────────────────────────────────

/**
 * Compute rolling mean predicted probability and rolling actual win rate
 * over time. Used to detect model drift.
 *
 * Records must have: predictedProbability, result, evaluatedAt.
 * Returns one data point per record (chronological), with rolling window stats.
 *
 * @param {Array<{ predictedProbability: number, result: string, evaluatedAt: string|Date }>} records
 * @param {number} [windowSize=20]  Rolling window size
 * @returns {Array<{
 *   index: number,
 *   date: string,
 *   predictedProb: number,
 *   outcome: 1|0|null,
 *   rollingPredictedMean: number | null,
 *   rollingActualRate: number | null,
 *   rollingBrier: number | null
 * }>}
 */
function computeProbabilityDrift(records, windowSize = 20) {
  if (!Array.isArray(records) || records.length === 0) return [];

  const sorted = [...records]
    .filter((r) => Number.isFinite(Number(r.predictedProbability)))
    .sort((a, b) => new Date(a.evaluatedAt).getTime() - new Date(b.evaluatedAt).getTime());

  return sorted.map((r, i) => {
    const windowStart = Math.max(0, i - windowSize + 1);
    const window = sorted.slice(windowStart, i + 1);
    const resolved = window.filter((w) => outcomeToNumeric(w.result) !== null);

    const rollingPredictedMean =
      window.length > 0
        ? roundDecimal(
            window.reduce((s, w) => s + Number(w.predictedProbability), 0) / window.length,
            6
          )
        : null;

    const rollingActualRate =
      resolved.length > 0
        ? roundDecimal(
            resolved.filter((w) => w.result === "WIN").length / resolved.length,
            6
          )
        : null;

    const rollingBrier =
      resolved.length > 0
        ? roundDecimal(
            resolved.reduce((s, w) => {
              const o = outcomeToNumeric(w.result);
              return s + (Number(w.predictedProbability) - o) ** 2;
            }, 0) / resolved.length,
            6
          )
        : null;

    return {
      index: i + 1,
      date: formatDate(r.evaluatedAt),
      predictedProb: roundDecimal(Number(r.predictedProbability), 6),
      outcome: outcomeToNumeric(r.result),
      rollingPredictedMean,
      rollingActualRate,
      rollingBrier
    };
  });
}

// ─── Aggregate calibration stats ──────────────────────────────────────────────

/**
 * Compute full calibration statistics from a set of resolved predictions.
 *
 * @param {Array<{ predictedProbability: number, result: string }>} records
 * @returns {{
 *   count: number,
 *   resolvedCount: number,
 *   meanBrierScore: number | null,
 *   meanPredictedProb: number | null,
 *   meanActualRate: number | null,
 *   reliability: number | null,
 *   resolution: number | null,
 *   calibrationError: number | null,
 *   byMarket: Record<string, { count: number, brierScore: number | null }>
 * }}
 */
function computeCalibrationStats(records) {
  const resolved = records.filter((r) => {
    const o = outcomeToNumeric(r.result);
    return o !== null && Number.isFinite(Number(r.predictedProbability));
  });

  if (resolved.length === 0) {
    return {
      count: records.length,
      resolvedCount: 0,
      meanBrierScore: null,
      meanPredictedProb: null,
      meanActualRate: null,
      reliability: null,
      resolution: null,
      calibrationError: null,
      byMarket: {}
    };
  }

  const n = resolved.length;
  const wins = resolved.filter((r) => r.result === "WIN").length;

  const meanPredictedProb = roundDecimal(
    resolved.reduce((s, r) => s + Number(r.predictedProbability), 0) / n,
    6
  );
  const meanActualRate = roundDecimal(wins / n, 6);

  // Mean Brier score
  const brierSum = resolved.reduce((s, r) => {
    const o = outcomeToNumeric(r.result);
    return s + (Number(r.predictedProbability) - o) ** 2;
  }, 0);
  const meanBrierScore = roundDecimal(brierSum / n, 6);

  // Calibration bins for reliability / resolution decomposition
  const bins = buildCalibrationBins(resolved, 10).filter((b) => b.resolvedCount > 0);

  // Reliability = Σ (n_k/N) * (p̄_k - ō_k)²
  // where p̄_k = mean predicted prob in bin k, ō_k = actual win rate in bin k
  const reliability =
    bins.length > 0
      ? roundDecimal(
          bins.reduce((s, b) => {
            return s + (b.resolvedCount / n) * (b.predictedMean - b.actualWinRate) ** 2;
          }, 0),
          6
        )
      : null;

  // Resolution = Σ (n_k/N) * (ō_k - ō)²
  // where ō = overall mean actual rate
  const resolution =
    bins.length > 0
      ? roundDecimal(
          bins.reduce((s, b) => {
            return s + (b.resolvedCount / n) * (b.actualWinRate - meanActualRate) ** 2;
          }, 0),
          6
        )
      : null;

  // Mean calibration error = |meanPredictedProb - meanActualRate|
  const calibrationError = roundDecimal(
    Math.abs(meanPredictedProb - meanActualRate),
    6
  );

  // Per-market breakdown
  const byMarket = {};
  const markets = [...new Set(resolved.map((r) => r.market).filter(Boolean))];
  for (const market of markets) {
    const mRecords = resolved.filter((r) => r.market === market);
    const mBrier = brierScoreMulti(mRecords);
    byMarket[market] = {
      count: mRecords.length,
      brierScore: mBrier?.score ?? null
    };
  }

  return {
    count: records.length,
    resolvedCount: n,
    meanBrierScore,
    meanPredictedProb,
    meanActualRate,
    reliability,
    resolution,
    calibrationError,
    byMarket
  };
}

// ─── Record builder ───────────────────────────────────────────────────────────

/**
 * Build a PredictionOutcome record payload ready for Prisma insert.
 * Captures the predicted probability at evaluation time.
 *
 * @param {{
 *   matchId: string,
 *   modelPredictionId: string,
 *   result: "WIN"|"LOSS"|"PUSH"|"UNRESOLVED",
 *   predictedProbability: number,
 *   market?: string,
 *   closingEdgePct?: number | null,
 *   realizedReturn?: number | null,
 *   evaluatedAt?: Date
 * }} params
 */
function buildOutcomeRecord({
  matchId,
  modelPredictionId,
  result,
  predictedProbability,
  market,
  closingEdgePct = null,
  realizedReturn = null,
  evaluatedAt = new Date()
}) {
  assertProbability(predictedProbability, "predictedProbability");

  const validResults = ["WIN", "LOSS", "PUSH", "UNRESOLVED"];
  if (!validResults.includes(result)) {
    throw new Error(`result must be one of: ${validResults.join(", ")}`);
  }

  return {
    matchId,
    modelPredictionId,
    result,
    predictedProbability: roundDecimal(predictedProbability, 6),
    market: market ?? null,
    closingEdgePct: closingEdgePct != null ? roundDecimal(closingEdgePct, 4) : null,
    realizedReturn: realizedReturn != null ? roundDecimal(realizedReturn, 4) : null,
    evaluatedAt
  };
}

// ─── Assertions & helpers ─────────────────────────────────────────────────────

function assertProbability(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be a finite number between 0 and 1 (got ${value}).`);
  }
}

function assertBinaryOutcome(value, label) {
  if (value !== 0 && value !== 1) {
    throw new Error(`${label} must be 0 or 1 (got ${value}).`);
  }
}

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

module.exports = {
  outcomeToNumeric,
  brierScore,
  brierScoreMulti,
  buildCalibrationBins,
  computeProbabilityDrift,
  computeCalibrationStats,
  buildOutcomeRecord
};
