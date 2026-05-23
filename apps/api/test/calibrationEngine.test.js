const {
  outcomeToNumeric,
  brierScore,
  brierScoreMulti,
  buildCalibrationBins,
  computeProbabilityDrift,
  computeCalibrationStats,
  buildOutcomeRecord
} = require("../src/services/calibrationEngine");

// ─── outcomeToNumeric ─────────────────────────────────────────────────────────

describe("outcomeToNumeric", () => {
  test("WIN → 1", () => expect(outcomeToNumeric("WIN")).toBe(1));
  test("LOSS → 0", () => expect(outcomeToNumeric("LOSS")).toBe(0));
  test("PUSH → null", () => expect(outcomeToNumeric("PUSH")).toBeNull());
  test("UNRESOLVED → null", () => expect(outcomeToNumeric("UNRESOLVED")).toBeNull());
});

// ─── brierScore ───────────────────────────────────────────────────────────────

describe("brierScore", () => {
  test("perfect prediction WIN: (1 - 1)² = 0", () => {
    expect(brierScore(1, 1)).toBe(0);
  });

  test("perfect prediction LOSS: (0 - 0)² = 0", () => {
    expect(brierScore(0, 0)).toBe(0);
  });

  test("worst prediction WIN: (0 - 1)² = 1", () => {
    expect(brierScore(0, 1)).toBe(1);
  });

  test("worst prediction LOSS: (1 - 0)² = 1", () => {
    expect(brierScore(1, 0)).toBe(1);
  });

  test("random prediction: (0.5 - 1)² = 0.25", () => {
    expect(brierScore(0.5, 1)).toBeCloseTo(0.25, 6);
  });

  test("typical prediction: (0.6 - 1)² = 0.16", () => {
    expect(brierScore(0.6, 1)).toBeCloseTo(0.16, 6);
  });

  test("throws on probability outside [0, 1]", () => {
    expect(() => brierScore(1.1, 1)).toThrow();
    expect(() => brierScore(-0.1, 0)).toThrow();
  });

  test("throws on non-binary outcome", () => {
    expect(() => brierScore(0.5, 0.5)).toThrow();
  });
});

// ─── brierScoreMulti ──────────────────────────────────────────────────────────

describe("brierScoreMulti", () => {
  const records = [
    { predictedProbability: 0.7, result: "WIN" },   // (0.7-1)² = 0.09
    { predictedProbability: 0.3, result: "LOSS" },  // (0.3-0)² = 0.09
    { predictedProbability: 0.6, result: "WIN" },   // (0.6-1)² = 0.16
    { predictedProbability: 0.4, result: "LOSS" }   // (0.4-0)² = 0.16
  ];

  test("returns correct mean Brier score", () => {
    const result = brierScoreMulti(records);
    expect(result).not.toBeNull();
    // mean = (0.09 + 0.09 + 0.16 + 0.16) / 4 = 0.125
    expect(result.score).toBeCloseTo(0.125, 5);
    expect(result.count).toBe(4);
  });

  test("excludes PUSH and UNRESOLVED from calculation", () => {
    const withPush = [
      ...records,
      { predictedProbability: 0.5, result: "PUSH" },
      { predictedProbability: 0.5, result: "UNRESOLVED" }
    ];
    const result = brierScoreMulti(withPush);
    expect(result.count).toBe(4); // PUSH and UNRESOLVED excluded
  });

  test("returns null for empty array", () => {
    expect(brierScoreMulti([])).toBeNull();
  });

  test("returns null when all records are PUSH/UNRESOLVED", () => {
    expect(brierScoreMulti([
      { predictedProbability: 0.5, result: "PUSH" },
      { predictedProbability: 0.5, result: "UNRESOLVED" }
    ])).toBeNull();
  });

  test("deterministic — same inputs always produce same output", () => {
    const a = brierScoreMulti(records);
    const b = brierScoreMulti(records);
    expect(a.score).toBe(b.score);
  });
});

// ─── buildCalibrationBins ─────────────────────────────────────────────────────

describe("buildCalibrationBins", () => {
  // 10 predictions: 5 in 0.5–0.6 bin (4 WIN, 1 LOSS), 5 in 0.8–0.9 bin (5 WIN)
  const records = [
    ...Array(4).fill({ predictedProbability: 0.55, result: "WIN" }),
    { predictedProbability: 0.55, result: "LOSS" },
    ...Array(5).fill({ predictedProbability: 0.85, result: "WIN" })
  ];

  test("returns correct number of bins", () => {
    const bins = buildCalibrationBins(records, 10);
    expect(bins).toHaveLength(10);
  });

  test("bin midpoints are evenly spaced", () => {
    const bins = buildCalibrationBins(records, 10);
    expect(bins[0].binMidpoint).toBeCloseTo(0.05, 4);
    expect(bins[9].binMidpoint).toBeCloseTo(0.95, 4);
  });

  test("0.55 bin has 5 records with 80% win rate", () => {
    const bins = buildCalibrationBins(records, 10);
    const bin = bins.find((b) => b.binMidpoint === 0.55);
    expect(bin).toBeDefined();
    expect(bin.count).toBe(5);
    expect(bin.actualWinRate).toBeCloseTo(0.8, 5);
  });

  test("0.85 bin has 5 records with 100% win rate", () => {
    const bins = buildCalibrationBins(records, 10);
    const bin = bins.find((b) => b.binMidpoint === 0.85);
    expect(bin).toBeDefined();
    expect(bin.count).toBe(5);
    expect(bin.actualWinRate).toBeCloseTo(1.0, 5);
  });

  test("empty bins have null actualWinRate", () => {
    const bins = buildCalibrationBins(records, 10);
    const emptyBin = bins.find((b) => b.count === 0);
    expect(emptyBin).toBeDefined();
    expect(emptyBin.actualWinRate).toBeNull();
  });

  test("returns empty array for empty input", () => {
    expect(buildCalibrationBins([], 10)).toHaveLength(0);
  });
});

// ─── computeProbabilityDrift ──────────────────────────────────────────────────

describe("computeProbabilityDrift", () => {
  const records = Array.from({ length: 30 }, (_, i) => ({
    predictedProbability: 0.55 + (i % 5) * 0.01,
    result: i % 3 === 0 ? "LOSS" : "WIN",
    evaluatedAt: new Date(2026, 0, i + 1).toISOString()
  }));

  test("returns one entry per resolved record", () => {
    const drift = computeProbabilityDrift(records, 10);
    expect(drift).toHaveLength(30);
  });

  test("each entry has required fields", () => {
    const drift = computeProbabilityDrift(records, 10);
    const first = drift[0];
    expect(first).toHaveProperty("index");
    expect(first).toHaveProperty("date");
    expect(first).toHaveProperty("predictedProb");
    expect(first).toHaveProperty("outcome");
    expect(first).toHaveProperty("rollingPredictedMean");
    expect(first).toHaveProperty("rollingActualRate");
    expect(first).toHaveProperty("rollingBrier");
  });

  test("index is 1-based", () => {
    const drift = computeProbabilityDrift(records, 10);
    expect(drift[0].index).toBe(1);
    expect(drift[29].index).toBe(30);
  });

  test("rolling window does not exceed windowSize", () => {
    // With windowSize=5, entry at index 10 uses records 6–10
    const drift = computeProbabilityDrift(records, 5);
    expect(drift[9].rollingPredictedMean).not.toBeNull();
  });

  test("returns empty array for empty input", () => {
    expect(computeProbabilityDrift([], 10)).toHaveLength(0);
  });

  test("is sorted chronologically", () => {
    const shuffled = [...records].sort(() => Math.random() - 0.5);
    const drift = computeProbabilityDrift(shuffled, 10);
    for (let i = 1; i < drift.length; i++) {
      expect(drift[i].index).toBeGreaterThan(drift[i - 1].index);
    }
  });
});

// ─── computeCalibrationStats ──────────────────────────────────────────────────

describe("computeCalibrationStats", () => {
  const records = [
    { predictedProbability: 0.7, result: "WIN",  market: "MONEYLINE" },
    { predictedProbability: 0.6, result: "WIN",  market: "MONEYLINE" },
    { predictedProbability: 0.4, result: "LOSS", market: "MONEYLINE" },
    { predictedProbability: 0.3, result: "LOSS", market: "MONEYLINE" },
    { predictedProbability: 0.55, result: "WIN", market: "TOTAL" },
    { predictedProbability: 0.45, result: "LOSS", market: "TOTAL" },
    { predictedProbability: 0.5, result: "PUSH", market: "MONEYLINE" } // excluded
  ];

  test("resolvedCount excludes PUSH", () => {
    const stats = computeCalibrationStats(records);
    expect(stats.resolvedCount).toBe(6);
    expect(stats.count).toBe(7);
  });

  test("meanPredictedProb is correct", () => {
    const stats = computeCalibrationStats(records);
    const expected = (0.7 + 0.6 + 0.4 + 0.3 + 0.55 + 0.45) / 6;
    expect(stats.meanPredictedProb).toBeCloseTo(expected, 5);
  });

  test("meanActualRate is correct (3 wins out of 6)", () => {
    const stats = computeCalibrationStats(records);
    expect(stats.meanActualRate).toBeCloseTo(3 / 6, 5);
  });

  test("meanBrierScore is a finite number", () => {
    const stats = computeCalibrationStats(records);
    expect(typeof stats.meanBrierScore).toBe("number");
    expect(isFinite(stats.meanBrierScore)).toBe(true);
  });

  test("byMarket contains MONEYLINE and TOTAL", () => {
    const stats = computeCalibrationStats(records);
    expect(stats.byMarket).toHaveProperty("MONEYLINE");
    expect(stats.byMarket).toHaveProperty("TOTAL");
  });

  test("returns null stats for empty input", () => {
    const stats = computeCalibrationStats([]);
    expect(stats.resolvedCount).toBe(0);
    expect(stats.meanBrierScore).toBeNull();
  });

  test("calibrationError = |meanPredicted - meanActual|", () => {
    const stats = computeCalibrationStats(records);
    const expected = Math.abs(stats.meanPredictedProb - stats.meanActualRate);
    expect(stats.calibrationError).toBeCloseTo(expected, 5);
  });
});

// ─── buildOutcomeRecord ───────────────────────────────────────────────────────

describe("buildOutcomeRecord", () => {
  const base = {
    matchId: "match-1",
    modelPredictionId: "pred-1",
    result: "WIN",
    predictedProbability: 0.65,
    market: "MONEYLINE"
  };

  test("returns correct shape", () => {
    const record = buildOutcomeRecord(base);
    expect(record.matchId).toBe("match-1");
    expect(record.modelPredictionId).toBe("pred-1");
    expect(record.result).toBe("WIN");
    expect(record.predictedProbability).toBeCloseTo(0.65, 6);
    expect(record.evaluatedAt).toBeInstanceOf(Date);
  });

  test("uses provided evaluatedAt", () => {
    const ts = new Date("2026-01-01T00:00:00Z");
    const record = buildOutcomeRecord({ ...base, evaluatedAt: ts });
    expect(record.evaluatedAt).toBe(ts);
  });

  test("throws on invalid probability", () => {
    expect(() => buildOutcomeRecord({ ...base, predictedProbability: 1.5 })).toThrow();
    expect(() => buildOutcomeRecord({ ...base, predictedProbability: -0.1 })).toThrow();
  });

  test("throws on invalid result", () => {
    expect(() => buildOutcomeRecord({ ...base, result: "INVALID" })).toThrow();
  });

  test("closingEdgePct and realizedReturn default to null", () => {
    const record = buildOutcomeRecord(base);
    expect(record.closingEdgePct).toBeNull();
    expect(record.realizedReturn).toBeNull();
  });

  test("accepts optional closingEdgePct and realizedReturn", () => {
    const record = buildOutcomeRecord({ ...base, closingEdgePct: 0.042, realizedReturn: 0.91 });
    expect(record.closingEdgePct).toBeCloseTo(0.042, 4);
    expect(record.realizedReturn).toBeCloseTo(0.91, 4);
  });
});
