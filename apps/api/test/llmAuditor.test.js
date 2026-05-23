const {
  assembleContext,
  parseAuditResponse,
  enforceGuardrails,
  loadSystemPrompt,
  auditPrediction,
  BANNED_PHRASES,
  VALID_SEVERITIES,
  VALID_RISK_RATINGS,
  VALID_DIRECTIONS,
  _resetPromptCache
} = require("../src/services/llmAuditor");

// ─── Fixtures ────────────────────────────────────────────────────────────────

const VALID_AUDIT = {
  modelWeaknesses: [
    {
      id: "MW-001",
      finding: "Recent xG inflated by weak opposition in last 5 fixtures.",
      severity: "HIGH",
      evidence: "3 of 5 recent opponents ranked bottom-5 in defensive xGA.",
      recommendation: "Weight xG by opponent defensive strength percentile."
    }
  ],
  marketWarnings: [
    {
      id: "MKT-001",
      finding: "Odds movement contradicts model direction.",
      severity: "HIGH",
      evidence: "Line moved from -150 to -130 while model favors home at 62%.",
      direction: "DIVERGENT"
    }
  ],
  uncertaintyFlags: [
    {
      id: "UNC-001",
      finding: "Starting lineup unconfirmed 4 hours before kickoff.",
      severity: "MEDIUM",
      dataAvailable: false,
      mitigationPossible: true
    }
  ],
  hiddenAssumptions: [
    {
      id: "HA-001",
      assumption: "Model assumes home-field advantage consistent with season average.",
      risk: "Playoff crowd dynamics may amplify or dampen home advantage unpredictably.",
      severity: "MEDIUM"
    }
  ],
  overallRiskRating: "ELEVATED",
  auditSummary: "The model prediction carries elevated risk due to opposition-quality bias in recent xG data and divergent odds movement. Significant uncertainty remains around lineup confirmation."
};

const SAMPLE_PREDICTION = {
  modelName: "xg-v2",
  modelVersion: "2.1.0",
  market: "MONEYLINE",
  selection: "Home",
  fairProbability: 0.62,
  fairPriceDecimal: 1.613,
  edgePct: 0.045,
  rationale: "Home team xG advantage in last 10 matches."
};

const SAMPLE_MATCH = {
  homeTeam: "Arsenal",
  awayTeam: "Brighton",
  league: "Premier League",
  startsAt: "2026-05-23T15:00:00Z",
  status: "SCHEDULED"
};

const SAMPLE_ODDS = [
  {
    bookmaker: "DraftKings",
    market: "MONEYLINE",
    selection: "Home",
    priceAmerican: -150,
    priceDecimal: 1.667,
    impliedProb: 0.6,
    bookmakerMargin: 0.045,
    capturedAt: "2026-05-22T08:00:00Z"
  },
  {
    bookmaker: "DraftKings",
    market: "MONEYLINE",
    selection: "Home",
    priceAmerican: -130,
    priceDecimal: 1.769,
    impliedProb: 0.565,
    bookmakerMargin: 0.042,
    capturedAt: "2026-05-22T12:00:00Z"
  }
];

// ─── System Prompt ───────────────────────────────────────────────────────────

describe("System prompt loading", () => {
  beforeEach(() => {
    _resetPromptCache();
  });

  test("loads the prompt from disk", () => {
    const prompt = loadSystemPrompt();

    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(100);
  });

  test("contains key constraint language", () => {
    const prompt = loadSystemPrompt();

    expect(prompt).toContain("NEVER");
    expect(prompt).toContain("sure bet");
    expect(prompt).toContain("MODEL WEAKNESSES");
    expect(prompt).toContain("MARKET WARNINGS");
    expect(prompt).toContain("UNCERTAINTY FLAGS");
    expect(prompt).toContain("HIDDEN ASSUMPTIONS");
  });

  test("caches the prompt on subsequent calls", () => {
    const first = loadSystemPrompt();
    const second = loadSystemPrompt();

    expect(first).toBe(second);
  });
});

// ─── Context Assembly ────────────────────────────────────────────────────────

describe("assembleContext", () => {
  test("includes match metadata", () => {
    const context = assembleContext({
      prediction: SAMPLE_PREDICTION,
      oddsSnapshots: SAMPLE_ODDS,
      match: SAMPLE_MATCH
    });

    expect(context).toContain("Arsenal");
    expect(context).toContain("Brighton");
    expect(context).toContain("Premier League");
  });

  test("includes model prediction details", () => {
    const context = assembleContext({
      prediction: SAMPLE_PREDICTION,
      oddsSnapshots: [],
      match: SAMPLE_MATCH
    });

    expect(context).toContain("xg-v2");
    expect(context).toContain("MONEYLINE");
    expect(context).toContain("62.00%");
    expect(context).toContain("4.50%");
  });

  test("includes odds snapshots with drift calculation", () => {
    const context = assembleContext({
      prediction: SAMPLE_PREDICTION,
      oddsSnapshots: SAMPLE_ODDS,
      match: SAMPLE_MATCH
    });

    expect(context).toContain("DraftKings");
    expect(context).toContain("Price drift");
    expect(context).toContain("lengthening");
  });

  test("flags missing odds as a risk factor", () => {
    const context = assembleContext({
      prediction: SAMPLE_PREDICTION,
      oddsSnapshots: [],
      match: SAMPLE_MATCH
    });

    expect(context).toContain("No odds snapshots available");
    expect(context).toContain("risk factor");
  });

  test("handles null prediction gracefully", () => {
    const context = assembleContext({
      prediction: null,
      oddsSnapshots: SAMPLE_ODDS,
      match: SAMPLE_MATCH
    });

    expect(context).toContain("Arsenal");
    expect(context).not.toContain("MODEL PREDICTION");
  });

  test("handles null match gracefully", () => {
    const context = assembleContext({
      prediction: SAMPLE_PREDICTION,
      oddsSnapshots: [],
      match: null
    });

    expect(context).toContain("xg-v2");
  });
});

// ─── Response Parsing ────────────────────────────────────────────────────────

describe("parseAuditResponse", () => {
  test("accepts a valid audit JSON string", () => {
    const result = parseAuditResponse(JSON.stringify(VALID_AUDIT));

    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
    expect(result.data.overallRiskRating).toBe("ELEVATED");
  });

  test("rejects invalid JSON", () => {
    const result = parseAuditResponse("not json at all");

    expect(result.valid).toBe(false);
    expect(result.error).toContain("not valid JSON");
  });

  test("rejects missing required keys", () => {
    const incomplete = { modelWeaknesses: [] };
    const result = parseAuditResponse(JSON.stringify(incomplete));

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Missing required keys");
    expect(result.error).toContain("marketWarnings");
  });

  test("rejects invalid overallRiskRating", () => {
    const bad = { ...VALID_AUDIT, overallRiskRating: "EXTREME" };
    const result = parseAuditResponse(JSON.stringify(bad));

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid overallRiskRating");
  });

  test("rejects empty auditSummary", () => {
    const bad = { ...VALID_AUDIT, auditSummary: "   " };
    const result = parseAuditResponse(JSON.stringify(bad));

    expect(result.valid).toBe(false);
    expect(result.error).toContain("auditSummary");
  });

  test("rejects non-array modelWeaknesses", () => {
    const bad = { ...VALID_AUDIT, modelWeaknesses: "not an array" };
    const result = parseAuditResponse(JSON.stringify(bad));

    expect(result.valid).toBe(false);
    expect(result.error).toContain("modelWeaknesses must be an array");
  });

  test("rejects non-array marketWarnings", () => {
    const bad = { ...VALID_AUDIT, marketWarnings: {} };
    const result = parseAuditResponse(JSON.stringify(bad));

    expect(result.valid).toBe(false);
  });

  test("rejects non-array uncertaintyFlags", () => {
    const bad = { ...VALID_AUDIT, uncertaintyFlags: null };
    const result = parseAuditResponse(JSON.stringify(bad));

    expect(result.valid).toBe(false);
  });

  test("rejects non-array hiddenAssumptions", () => {
    const bad = { ...VALID_AUDIT, hiddenAssumptions: 42 };
    const result = parseAuditResponse(JSON.stringify(bad));

    expect(result.valid).toBe(false);
  });
});

// ─── Guardrail Enforcement ───────────────────────────────────────────────────

describe("enforceGuardrails", () => {
  test("returns no violations for a clean audit", () => {
    const violations = enforceGuardrails(VALID_AUDIT);

    expect(violations).toEqual([]);
  });

  test("catches banned phrase: sure bet", () => {
    const tainted = {
      ...VALID_AUDIT,
      auditSummary: "This is a sure bet for the home team."
    };
    const violations = enforceGuardrails(tainted);

    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].type).toBe("BANNED_PHRASE");
    expect(violations[0].detail).toContain("sure bet");
  });

  test("catches banned phrase: guaranteed win", () => {
    const tainted = {
      ...VALID_AUDIT,
      modelWeaknesses: [
        { ...VALID_AUDIT.modelWeaknesses[0], finding: "This is a guaranteed win scenario." }
      ]
    };
    const violations = enforceGuardrails(tainted);

    expect(violations.some((v) => v.detail.includes("guaranteed win"))).toBe(true);
  });

  test("catches banned phrase: hammer this", () => {
    const tainted = {
      ...VALID_AUDIT,
      auditSummary: "You should hammer this line before it moves."
    };
    const violations = enforceGuardrails(tainted);

    expect(violations.some((v) => v.detail.includes("hammer this"))).toBe(true);
  });

  test("catches invalid severity on findings", () => {
    const tainted = {
      ...VALID_AUDIT,
      modelWeaknesses: [
        { id: "MW-001", finding: "Test", severity: "EXTREME", evidence: "n/a", recommendation: "n/a" }
      ]
    };
    const violations = enforceGuardrails(tainted);

    expect(violations.some((v) => v.type === "INVALID_SEVERITY")).toBe(true);
  });

  test("catches invalid direction on market warnings", () => {
    const tainted = {
      ...VALID_AUDIT,
      marketWarnings: [
        { id: "MKT-001", finding: "Test", severity: "HIGH", evidence: "n/a", direction: "SIDEWAYS" }
      ]
    };
    const violations = enforceGuardrails(tainted);

    expect(violations.some((v) => v.type === "INVALID_DIRECTION")).toBe(true);
  });

  test("flags an empty audit as implausible", () => {
    const empty = {
      modelWeaknesses: [],
      marketWarnings: [],
      uncertaintyFlags: [],
      hiddenAssumptions: [],
      overallRiskRating: "LOW",
      auditSummary: "Everything looks fine."
    };
    const violations = enforceGuardrails(empty);

    expect(violations.some((v) => v.type === "EMPTY_AUDIT")).toBe(true);
  });

  test("detects multiple violations simultaneously", () => {
    const tainted = {
      modelWeaknesses: [
        { id: "MW-001", finding: "This is a sure bet.", severity: "EXTREME", evidence: "n/a", recommendation: "n/a" }
      ],
      marketWarnings: [],
      uncertaintyFlags: [],
      hiddenAssumptions: [],
      overallRiskRating: "LOW",
      auditSummary: "Guaranteed win for the favorite."
    };
    const violations = enforceGuardrails(tainted);

    expect(violations.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── Integration: auditPrediction ────────────────────────────────────────────

describe("auditPrediction", () => {
  test("returns LLM_ERROR when no API key is configured", async () => {
    const originalKey = process.env.LLM_API_KEY;
    const originalOaiKey = process.env.OPENAI_API_KEY;
    delete process.env.LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      const result = await auditPrediction({
        prediction: SAMPLE_PREDICTION,
        oddsSnapshots: SAMPLE_ODDS,
        match: SAMPLE_MATCH,
        options: { apiKey: undefined }
      });

      expect(result.status).toBe("LLM_ERROR");
      expect(result.error).toContain("not configured");
    } finally {
      if (originalKey !== undefined) process.env.LLM_API_KEY = originalKey;
      if (originalOaiKey !== undefined) process.env.OPENAI_API_KEY = originalOaiKey;
    }
  });

  test("returns OK when LLM returns valid compliant output", async () => {
    const mockHttpClient = {
      post: vi.fn().mockResolvedValue({
        data: {
          choices: [{ message: { content: JSON.stringify(VALID_AUDIT) } }]
        }
      })
    };

    const result = await auditPrediction({
      prediction: SAMPLE_PREDICTION,
      oddsSnapshots: SAMPLE_ODDS,
      match: SAMPLE_MATCH,
      options: { httpClient: mockHttpClient, apiKey: "test-key" }
    });

    expect(result.status).toBe("OK");
    expect(result.audit.overallRiskRating).toBe("ELEVATED");
    expect(result.guardrailViolations).toEqual([]);
  });

  test("returns PARSE_ERROR when LLM returns invalid JSON", async () => {
    const mockHttpClient = {
      post: vi.fn().mockResolvedValue({
        data: {
          choices: [{ message: { content: "I am not JSON" } }]
        }
      })
    };

    const result = await auditPrediction({
      prediction: SAMPLE_PREDICTION,
      oddsSnapshots: SAMPLE_ODDS,
      match: SAMPLE_MATCH,
      options: { httpClient: mockHttpClient, apiKey: "test-key" }
    });

    expect(result.status).toBe("PARSE_ERROR");
  });

  test("returns GUARDRAIL_VIOLATION when LLM output contains banned phrases", async () => {
    const taintedAudit = {
      ...VALID_AUDIT,
      auditSummary: "This is a sure bet for the home side."
    };

    const mockHttpClient = {
      post: vi.fn().mockResolvedValue({
        data: {
          choices: [{ message: { content: JSON.stringify(taintedAudit) } }]
        }
      })
    };

    const result = await auditPrediction({
      prediction: SAMPLE_PREDICTION,
      oddsSnapshots: SAMPLE_ODDS,
      match: SAMPLE_MATCH,
      options: { httpClient: mockHttpClient, apiKey: "test-key" }
    });

    expect(result.status).toBe("GUARDRAIL_VIOLATION");
    expect(result.guardrailViolations.length).toBeGreaterThan(0);
  });

  test("returns LLM_ERROR when API call fails", async () => {
    const mockHttpClient = {
      post: vi.fn().mockRejectedValue(new Error("Connection timeout"))
    };

    const result = await auditPrediction({
      prediction: SAMPLE_PREDICTION,
      oddsSnapshots: SAMPLE_ODDS,
      match: SAMPLE_MATCH,
      options: { httpClient: mockHttpClient, apiKey: "test-key" }
    });

    expect(result.status).toBe("LLM_ERROR");
    expect(result.error).toContain("timeout");
  });

  test("returns LLM_ERROR when response has no content", async () => {
    const mockHttpClient = {
      post: vi.fn().mockResolvedValue({
        data: { choices: [{ message: { content: null } }] }
      })
    };

    const result = await auditPrediction({
      prediction: SAMPLE_PREDICTION,
      oddsSnapshots: SAMPLE_ODDS,
      match: SAMPLE_MATCH,
      options: { httpClient: mockHttpClient, apiKey: "test-key" }
    });

    expect(result.status).toBe("LLM_ERROR");
    expect(result.error).toContain("empty response");
  });

  test("sends assembled context to LLM", async () => {
    const mockHttpClient = {
      post: vi.fn().mockResolvedValue({
        data: {
          choices: [{ message: { content: JSON.stringify(VALID_AUDIT) } }]
        }
      })
    };

    await auditPrediction({
      prediction: SAMPLE_PREDICTION,
      oddsSnapshots: SAMPLE_ODDS,
      match: SAMPLE_MATCH,
      options: { httpClient: mockHttpClient, apiKey: "test-key" }
    });

    const callArgs = mockHttpClient.post.mock.calls[0];
    const messages = callArgs[1].messages;
    const userMessage = messages.find((m) => m.role === "user");

    expect(userMessage.content).toContain("Arsenal");
    expect(userMessage.content).toContain("xg-v2");
    expect(userMessage.content).toContain("DraftKings");
  });

  test("includes context in the response for traceability", async () => {
    const mockHttpClient = {
      post: vi.fn().mockResolvedValue({
        data: {
          choices: [{ message: { content: JSON.stringify(VALID_AUDIT) } }]
        }
      })
    };

    const result = await auditPrediction({
      prediction: SAMPLE_PREDICTION,
      oddsSnapshots: SAMPLE_ODDS,
      match: SAMPLE_MATCH,
      options: { httpClient: mockHttpClient, apiKey: "test-key" }
    });

    expect(result.context).toContain("PREDICTION CONTEXT");
  });
});

// ─── Constant Validation ─────────────────────────────────────────────────────

describe("Constants", () => {
  test("BANNED_PHRASES contains critical guardrail phrases", () => {
    expect(BANNED_PHRASES).toContain("sure bet");
    expect(BANNED_PHRASES).toContain("guaranteed win");
    expect(BANNED_PHRASES).toContain("free money");
    expect(BANNED_PHRASES).toContain("max bet");
  });

  test("VALID_SEVERITIES covers expected levels", () => {
    expect(VALID_SEVERITIES).toEqual(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
  });

  test("VALID_RISK_RATINGS covers expected levels", () => {
    expect(VALID_RISK_RATINGS).toEqual(["LOW", "MODERATE", "ELEVATED", "HIGH", "CRITICAL"]);
  });

  test("VALID_DIRECTIONS covers expected directions", () => {
    expect(VALID_DIRECTIONS).toEqual(["CONVERGENT", "DIVERGENT", "NEUTRAL", "UNKNOWN"]);
  });
});
