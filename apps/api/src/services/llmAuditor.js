const fs = require("fs");
const path = require("path");
const axios = require("axios");

// ─── Prompt Loading ──────────────────────────────────────────────────────────

const PROMPT_PATH = path.join(__dirname, "..", "prompts", "riskAuditorPrompt.txt");

let _cachedPrompt = null;

function loadSystemPrompt() {
  if (_cachedPrompt) {
    return _cachedPrompt;
  }

  _cachedPrompt = fs.readFileSync(PROMPT_PATH, "utf-8");
  return _cachedPrompt;
}

// ─── Guardrail Constants ─────────────────────────────────────────────────────

const BANNED_PHRASES = [
  "sure bet",
  "guaranteed win",
  "guaranteed winner",
  "lock of the day",
  "lock of the week",
  "free money",
  "can't lose",
  "cannot lose",
  "100% chance",
  "100% confident",
  "definite win",
  "certain to win",
  "will definitely",
  "no way they lose",
  "slam dunk",
  "max bet",
  "hammer this",
  "smash this",
  "love this play"
];

const VALID_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const VALID_RISK_RATINGS = ["LOW", "MODERATE", "ELEVATED", "HIGH", "CRITICAL"];
const VALID_DIRECTIONS = ["CONVERGENT", "DIVERGENT", "NEUTRAL", "UNKNOWN"];

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TIMEOUT_MS = 30000;

// ─── Context Assembly ────────────────────────────────────────────────────────

function assembleContext({ prediction, oddsSnapshots, match }) {
  const sections = [];

  sections.push("=== PREDICTION CONTEXT ===");

  if (match) {
    sections.push(`Match: ${match.homeTeam || "Home"} vs ${match.awayTeam || "Away"}`);
    sections.push(`League: ${match.league || "Unknown"}`);
    sections.push(`Starts At: ${match.startsAt || "Unknown"}`);
    sections.push(`Status: ${match.status || "SCHEDULED"}`);
  }

  if (prediction) {
    sections.push("");
    sections.push("=== MODEL PREDICTION ===");
    sections.push(`Model: ${prediction.modelName || "Unknown"} v${prediction.modelVersion || "?"}`);
    sections.push(`Market: ${prediction.market || "Unknown"}`);
    sections.push(`Selection: ${prediction.selection || "Unknown"}`);
    sections.push(`Fair Probability: ${formatPct(prediction.fairProbability)}`);
    sections.push(`Fair Price (Decimal): ${prediction.fairPriceDecimal || "N/A"}`);
    sections.push(`Edge: ${formatPct(prediction.edgePct)}`);

    if (prediction.rationale) {
      sections.push(`Rationale: ${prediction.rationale}`);
    }
  }

  if (Array.isArray(oddsSnapshots) && oddsSnapshots.length > 0) {
    sections.push("");
    sections.push("=== ODDS SNAPSHOTS (chronological) ===");

    for (const snapshot of oddsSnapshots) {
      const parts = [
        snapshot.bookmaker || "Unknown Book",
        `Market: ${snapshot.market || "?"}`,
        `Selection: ${snapshot.selection || "?"}`,
        `American: ${snapshot.priceAmerican ?? "?"}`,
        `Decimal: ${snapshot.priceDecimal ?? "?"}`,
        `Implied: ${formatPct(snapshot.impliedProb)}`,
        `Margin: ${formatPct(snapshot.bookmakerMargin)}`,
        `Captured: ${snapshot.capturedAt || "?"}`
      ];
      sections.push(`  • ${parts.join(" | ")}`);
    }

    const firstOdds = oddsSnapshots[0];
    const lastOdds = oddsSnapshots[oddsSnapshots.length - 1];

    if (firstOdds.priceDecimal && lastOdds.priceDecimal) {
      const drift = Number(lastOdds.priceDecimal) - Number(firstOdds.priceDecimal);
      sections.push(`  → Price drift: ${drift > 0 ? "+" : ""}${drift.toFixed(4)} (${drift > 0 ? "lengthening" : drift < 0 ? "shortening" : "stable"})`);
    }
  } else {
    sections.push("");
    sections.push("=== ODDS SNAPSHOTS ===");
    sections.push("  No odds snapshots available. This is itself a risk factor.");
  }

  return sections.join("\n");
}

function formatPct(value) {
  if (value === null || value === undefined) {
    return "N/A";
  }

  const num = Number(value);

  if (!Number.isFinite(num)) {
    return "N/A";
  }

  return `${(num * 100).toFixed(2)}%`;
}

// ─── LLM Call ────────────────────────────────────────────────────────────────

async function callLlm({ userMessage, options = {} }) {
  const apiKey = options.apiKey || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = options.baseUrl || process.env.LLM_BASE_URL || "https://api.openai.com/v1";
  const model = options.model || process.env.LLM_MODEL || DEFAULT_MODEL;
  const httpClient = options.httpClient || axios;

  if (!apiKey) {
    return {
      success: false,
      error: "LLM_API_KEY is not configured.",
      raw: null
    };
  }

  const systemPrompt = loadSystemPrompt();

  try {
    const response = await httpClient.post(
      `${baseUrl}/chat/completions`,
      {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: options.temperature ?? DEFAULT_TEMPERATURE,
        max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        response_format: { type: "json_object" }
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        timeout: options.timeout ?? DEFAULT_TIMEOUT_MS
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;

    if (!content) {
      return {
        success: false,
        error: "LLM returned an empty response.",
        raw: response.data
      };
    }

    return {
      success: true,
      error: null,
      raw: content
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
      raw: null
    };
  }
}

// ─── Output Parsing & Validation ─────────────────────────────────────────────

function parseAuditResponse(raw) {
  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      valid: false,
      error: "LLM response is not valid JSON.",
      data: null
    };
  }

  const requiredKeys = [
    "modelWeaknesses",
    "marketWarnings",
    "uncertaintyFlags",
    "hiddenAssumptions",
    "overallRiskRating",
    "auditSummary"
  ];

  const missingKeys = requiredKeys.filter((key) => !(key in parsed));

  if (missingKeys.length > 0) {
    return {
      valid: false,
      error: `Missing required keys: ${missingKeys.join(", ")}`,
      data: null
    };
  }

  if (!Array.isArray(parsed.modelWeaknesses)) {
    return { valid: false, error: "modelWeaknesses must be an array.", data: null };
  }

  if (!Array.isArray(parsed.marketWarnings)) {
    return { valid: false, error: "marketWarnings must be an array.", data: null };
  }

  if (!Array.isArray(parsed.uncertaintyFlags)) {
    return { valid: false, error: "uncertaintyFlags must be an array.", data: null };
  }

  if (!Array.isArray(parsed.hiddenAssumptions)) {
    return { valid: false, error: "hiddenAssumptions must be an array.", data: null };
  }

  if (!VALID_RISK_RATINGS.includes(parsed.overallRiskRating)) {
    return {
      valid: false,
      error: `Invalid overallRiskRating: "${parsed.overallRiskRating}". Must be one of: ${VALID_RISK_RATINGS.join(", ")}`,
      data: null
    };
  }

  if (typeof parsed.auditSummary !== "string" || parsed.auditSummary.trim().length === 0) {
    return { valid: false, error: "auditSummary must be a non-empty string.", data: null };
  }

  return { valid: true, error: null, data: parsed };
}

// ─── Guardrail Enforcement ───────────────────────────────────────────────────

function enforceGuardrails(auditData) {
  const violations = [];
  const fullText = JSON.stringify(auditData).toLowerCase();

  for (const phrase of BANNED_PHRASES) {
    if (fullText.includes(phrase.toLowerCase())) {
      violations.push({
        type: "BANNED_PHRASE",
        detail: `Output contains banned phrase: "${phrase}"`
      });
    }
  }

  const allFindings = [
    ...auditData.modelWeaknesses,
    ...auditData.marketWarnings,
    ...auditData.uncertaintyFlags,
    ...auditData.hiddenAssumptions
  ];

  for (const finding of allFindings) {
    if (finding.severity && !VALID_SEVERITIES.includes(finding.severity)) {
      violations.push({
        type: "INVALID_SEVERITY",
        detail: `Finding "${finding.id || "unknown"}" has invalid severity: "${finding.severity}"`
      });
    }
  }

  for (const warning of auditData.marketWarnings) {
    if (warning.direction && !VALID_DIRECTIONS.includes(warning.direction)) {
      violations.push({
        type: "INVALID_DIRECTION",
        detail: `Market warning "${warning.id || "unknown"}" has invalid direction: "${warning.direction}"`
      });
    }
  }

  if (auditData.modelWeaknesses.length === 0
    && auditData.marketWarnings.length === 0
    && auditData.uncertaintyFlags.length === 0
    && auditData.hiddenAssumptions.length === 0) {
    violations.push({
      type: "EMPTY_AUDIT",
      detail: "Audit produced zero findings across all categories. This is implausible and suggests LLM failure."
    });
  }

  return violations;
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

async function auditPrediction({ prediction, oddsSnapshots, match, options = {} }) {
  const userMessage = assembleContext({ prediction, oddsSnapshots, match });

  const llmResult = await callLlm({ userMessage, options });

  if (!llmResult.success) {
    return {
      status: "LLM_ERROR",
      error: llmResult.error,
      audit: null,
      guardrailViolations: [],
      context: userMessage
    };
  }

  const parseResult = parseAuditResponse(llmResult.raw);

  if (!parseResult.valid) {
    return {
      status: "PARSE_ERROR",
      error: parseResult.error,
      audit: null,
      guardrailViolations: [],
      context: userMessage,
      rawResponse: llmResult.raw
    };
  }

  const violations = enforceGuardrails(parseResult.data);

  if (violations.length > 0) {
    return {
      status: "GUARDRAIL_VIOLATION",
      error: `${violations.length} guardrail violation(s) detected.`,
      audit: parseResult.data,
      guardrailViolations: violations,
      context: userMessage
    };
  }

  return {
    status: "OK",
    error: null,
    audit: parseResult.data,
    guardrailViolations: [],
    context: userMessage
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  auditPrediction,
  assembleContext,
  callLlm,
  parseAuditResponse,
  enforceGuardrails,
  loadSystemPrompt,
  BANNED_PHRASES,
  VALID_SEVERITIES,
  VALID_RISK_RATINGS,
  VALID_DIRECTIONS,
  _resetPromptCache() {
    _cachedPrompt = null;
  }
};
