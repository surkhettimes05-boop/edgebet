const {
  calculateClv,
  calculateClvProbDelta,
  calculateClvOddsRatio,
  trackClv,
  buildClvRecord,
  aggregateClvStats
} = require("../src/services/clvEngine");

// ─── calculateClv (full breakdown) ───────────────────────────────────────────

describe("calculateClv — full breakdown", () => {
  test("returns correct structure", () => {
    const result = calculateClv({ entryDecimal: 2.1, closingDecimal: 2.0 });
    expect(result).toHaveProperty("entryImpliedProb");
    expect(result).toHaveProperty("closingImpliedProb");
    expect(result).toHaveProperty("clvProbDelta");
    expect(result).toHaveProperty("clvOddsRatio");
    expect(result).toHaveProperty("beatingClosingLine");
  });

  test("accepts legacy entryPrice/closingPrice keys", () => {
    const result = calculateClv({ entryPrice: 2.1, closingPrice: 2.0 });
    expect(result).toHaveProperty("clvProbDelta");
  });

  test("entry odds longer than close → positive odds ratio (beat closing line)", () => {
    // Entry 2.10, close 2.00 → odds ratio = 2.10/2.00 - 1 = 0.05
    const result = calculateClv({ entryDecimal: 2.1, closingDecimal: 2.0 });
    expect(result.clvOddsRatio).toBeCloseTo(0.05, 5);
    expect(result.beatingClosingLine).toBe(true);
  });

  test("entry odds shorter than close → negative odds ratio (missed closing line)", () => {
    const result = calculateClv({ entryDecimal: 2.0, closingDecimal: 2.1 });
    expect(result.clvOddsRatio).toBeLessThan(0);
    expect(result.beatingClosingLine).toBe(false);
  });

  test("CLV prob delta: positive when closing implied prob > entry implied prob", () => {
    // Entry 2.10 → implied 0.4762, Close 2.00 → implied 0.5000
    // delta = 0.5000 - 0.4762 = +0.0238 (positive = beat closing line)
    const result = calculateClv({ entryDecimal: 2.1, closingDecimal: 2.0 });
    expect(result.clvProbDelta).toBeGreaterThan(0);
    expect(result.entryImpliedProb).toBeCloseTo(1 / 2.1, 5);
    expect(result.closingImpliedProb).toBeCloseTo(1 / 2.0, 5);
  });

  test("equal entry and closing odds → zero CLV", () => {
    const result = calculateClv({ entryDecimal: 2.0, closingDecimal: 2.0 });
    expect(result.clvProbDelta).toBe(0);
    expect(result.clvOddsRatio).toBe(0);
  });

  test("throws on invalid decimal odds (≤ 1)", () => {
    expect(() => calculateClv({ entryDecimal: 0.9, closingDecimal: 2.0 })).toThrow();
    expect(() => calculateClv({ entryDecimal: 2.0, closingDecimal: 1.0 })).toThrow();
  });
});

// ─── calculateClvProbDelta ────────────────────────────────────────────────────

describe("calculateClvProbDelta", () => {
  test("returns a number", () => {
    expect(typeof calculateClvProbDelta(2.1, 2.0)).toBe("number");
  });

  test("positive when entry odds longer than close", () => {
    expect(calculateClvProbDelta(2.1, 2.0)).toBeGreaterThan(0);
  });

  test("negative when entry odds shorter than close", () => {
    expect(calculateClvProbDelta(2.0, 2.1)).toBeLessThan(0);
  });

  test("deterministic — same inputs always produce same output", () => {
    const a = calculateClvProbDelta(1.91, 1.85);
    const b = calculateClvProbDelta(1.91, 1.85);
    expect(a).toBe(b);
  });
});

// ─── calculateClvOddsRatio ────────────────────────────────────────────────────

describe("calculateClvOddsRatio", () => {
  test("2.10 entry / 2.00 close = +0.05", () => {
    expect(calculateClvOddsRatio(2.1, 2.0)).toBeCloseTo(0.05, 5);
  });

  test("2.00 entry / 2.10 close ≈ -0.0476", () => {
    expect(calculateClvOddsRatio(2.0, 2.1)).toBeCloseTo(-0.047619, 4);
  });
});

// ─── trackClv (legacy shim) ───────────────────────────────────────────────────

describe("trackClv — legacy shim", () => {
  test("returns expected shape with clvPct as odds ratio", () => {
    const result = trackClv({
      trackedBetId: "bet-1",
      oddsSnapshotId: "odds-1",
      entryPrice: 2.1,
      closingPrice: 2.0,
      measuredAt: "2026-05-22T20:00:00Z"
    });

    expect(result).toEqual({
      trackedBetId: "bet-1",
      oddsSnapshotId: "odds-1",
      entryPrice: 2.1,
      closingPrice: 2.0,
      clvPct: expect.closeTo(0.05, 5),
      measuredAt: "2026-05-22T20:00:00Z"
    });
  });

  test("null oddsSnapshotId when not provided", () => {
    const result = trackClv({
      trackedBetId: "bet-2",
      entryPrice: 2.0,
      closingPrice: 2.0,
      measuredAt: new Date()
    });
    expect(result.oddsSnapshotId).toBeNull();
  });
});

// ─── buildClvRecord ───────────────────────────────────────────────────────────

describe("buildClvRecord", () => {
  test("returns full record with all fields", () => {
    const record = buildClvRecord({
      trackedBetId: "bet-1",
      entryDecimal: 2.1,
      closingDecimal: 2.0
    });

    expect(record.trackedBetId).toBe("bet-1");
    expect(record.entryPrice).toBe(2.1);
    expect(record.closingPrice).toBe(2.0);
    expect(typeof record.clvPct).toBe("number");
    expect(typeof record.clvOddsRatio).toBe("number");
    expect(typeof record.entryImpliedProb).toBe("number");
    expect(typeof record.closingImpliedProb).toBe("number");
    expect(typeof record.beatingClosingLine).toBe("boolean");
    expect(record.measuredAt).toBeInstanceOf(Date);
  });

  test("clvPct is the probability delta", () => {
    const record = buildClvRecord({ trackedBetId: "x", entryDecimal: 2.1, closingDecimal: 2.0 });
    const expectedDelta = 1 / 2.0 - 1 / 2.1;
    expect(record.clvPct).toBeCloseTo(expectedDelta, 5);
  });

  test("uses provided measuredAt", () => {
    const ts = new Date("2026-01-01T00:00:00Z");
    const record = buildClvRecord({ trackedBetId: "x", entryDecimal: 2.0, closingDecimal: 2.0, measuredAt: ts });
    expect(record.measuredAt).toBe(ts);
  });
});

// ─── aggregateClvStats ────────────────────────────────────────────────────────

describe("aggregateClvStats", () => {
  const records = [
    { clvPct: 0.02, entryPrice: 2.1, closingPrice: 2.0, measuredAt: "2026-05-01" },
    { clvPct: -0.01, entryPrice: 2.0, closingPrice: 2.05, measuredAt: "2026-05-02" },
    { clvPct: 0.03, entryPrice: 2.2, closingPrice: 2.1, measuredAt: "2026-05-03" },
    { clvPct: 0.015, entryPrice: 1.95, closingPrice: 1.9, measuredAt: "2026-05-04" }
  ];

  test("returns correct count", () => {
    expect(aggregateClvStats(records).count).toBe(4);
  });

  test("avgClvProbDelta is mean of clvPct values", () => {
    const expected = (0.02 - 0.01 + 0.03 + 0.015) / 4;
    expect(aggregateClvStats(records).avgClvProbDelta).toBeCloseTo(expected, 5);
  });

  test("positiveCount and negativeCount are correct", () => {
    const stats = aggregateClvStats(records);
    expect(stats.positiveCount).toBe(3);
    expect(stats.negativeCount).toBe(1);
  });

  test("positiveRate = 3/4 = 0.75", () => {
    expect(aggregateClvStats(records).positiveRate).toBeCloseTo(0.75, 4);
  });

  test("trend array has same length as records", () => {
    expect(aggregateClvStats(records).trend).toHaveLength(4);
  });

  test("trend cumAvg is monotonically computed", () => {
    const { trend } = aggregateClvStats(records);
    // First cumAvg = first clvPct
    expect(trend[0].cumAvg).toBeCloseTo(records[0].clvPct, 5);
  });

  test("returns empty stats for empty array", () => {
    const stats = aggregateClvStats([]);
    expect(stats.count).toBe(0);
    expect(stats.avgClvProbDelta).toBeNull();
    expect(stats.trend).toHaveLength(0);
  });
});
