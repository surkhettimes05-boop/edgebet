/**
 * calibrationController.js
 *
 * GET  /calibration          — aggregate calibration stats + bins + drift
 * POST /calibration/outcomes — record a prediction outcome
 */

const { PrismaClient } = require("@prisma/client");
const {
  buildCalibrationBins,
  computeProbabilityDrift,
  computeCalibrationStats,
  buildOutcomeRecord
} = require("../services/calibrationEngine");

const prisma = new PrismaClient();

const VALID_RESULTS = ["WIN", "LOSS", "PUSH", "UNRESOLVED"];

// ─── GET /calibration ─────────────────────────────────────────────────────────

async function getCalibration(req, res) {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({
        status: "OK",
        data: buildEmptyCalibrationResponse(),
        meta: { source: "empty", note: "Database not configured." }
      });
    }

    // Fetch all prediction outcomes with their parent prediction
    const outcomes = await prisma.predictionOutcome.findMany({
      orderBy: { evaluatedAt: "asc" },
      include: {
        modelPrediction: {
          select: {
            market: true,
            modelName: true,
            modelVersion: true,
            fairProbability: true
          }
        }
      }
    });

    // Normalise records — use stored predictedProbability if present,
    // fall back to modelPrediction.fairProbability for legacy records
    const records = outcomes.map((o) => ({
      id: o.id,
      result: o.result,
      predictedProbability: o.predictedProbability != null
        ? Number(o.predictedProbability)
        : Number(o.modelPrediction.fairProbability),
      market: o.modelPrediction.market,
      modelName: o.modelPrediction.modelName,
      modelVersion: o.modelPrediction.modelVersion,
      evaluatedAt: o.evaluatedAt
    }));

    const stats = computeCalibrationStats(records);
    const bins = buildCalibrationBins(records, 10);
    const drift = computeProbabilityDrift(records, 20);

    return res.status(200).json({
      status: "OK",
      data: { stats, bins, drift },
      meta: {
        totalOutcomes: outcomes.length,
        resolvedOutcomes: stats.resolvedCount,
        note: "Brier score: lower is better (0 = perfect, 0.25 = random). Calibration bins show predicted vs actual win rate."
      }
    });
  } catch (error) {
    console.error("CALIBRATION_GET ERROR:", error);
    return res.status(500).json({ status: "INTERNAL_ERROR", error: error.message });
  }
}

// ─── POST /calibration/outcomes ───────────────────────────────────────────────

async function recordOutcome(req, res) {
  const {
    modelPredictionId,
    matchId,
    result,
    predictedProbability,
    closingEdgePct,
    realizedReturn
  } = req.body;

  // Validation
  if (!modelPredictionId || typeof modelPredictionId !== "string") {
    return res.status(400).json({ status: "INVALID_INPUT", error: "modelPredictionId is required." });
  }
  if (!matchId || typeof matchId !== "string") {
    return res.status(400).json({ status: "INVALID_INPUT", error: "matchId is required." });
  }
  if (!result || !VALID_RESULTS.includes(result)) {
    return res.status(400).json({
      status: "INVALID_INPUT",
      error: `result must be one of: ${VALID_RESULTS.join(", ")}`
    });
  }
  if (predictedProbability == null || isNaN(Number(predictedProbability))) {
    return res.status(400).json({ status: "INVALID_INPUT", error: "predictedProbability is required and must be a number." });
  }

  try {
    // Verify the prediction exists
    const prediction = await prisma.modelPrediction.findUnique({
      where: { id: modelPredictionId }
    });
    if (!prediction) {
      return res.status(404).json({ status: "NOT_FOUND", error: "ModelPrediction not found." });
    }

    let record;
    try {
      record = buildOutcomeRecord({
        matchId,
        modelPredictionId,
        result,
        predictedProbability: Number(predictedProbability),
        market: prediction.market,
        closingEdgePct: closingEdgePct != null ? Number(closingEdgePct) : null,
        realizedReturn: realizedReturn != null ? Number(realizedReturn) : null
      });
    } catch (validationError) {
      return res.status(400).json({ status: "INVALID_INPUT", error: validationError.message });
    }

    const outcome = await prisma.predictionOutcome.create({
      data: {
        matchId: record.matchId,
        modelPredictionId: record.modelPredictionId,
        result: record.result,
        predictedProbability: record.predictedProbability,
        closingEdgePct: record.closingEdgePct,
        realizedReturn: record.realizedReturn,
        evaluatedAt: record.evaluatedAt
      }
    });

    return res.status(201).json({ status: "OK", data: outcome });
  } catch (error) {
    console.error("RECORD_OUTCOME ERROR:", error);
    return res.status(500).json({ status: "INTERNAL_ERROR", error: error.message });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildEmptyCalibrationResponse() {
  return {
    stats: {
      count: 0,
      resolvedCount: 0,
      meanBrierScore: null,
      meanPredictedProb: null,
      meanActualRate: null,
      reliability: null,
      resolution: null,
      calibrationError: null,
      byMarket: {}
    },
    bins: [],
    drift: []
  };
}

module.exports = { getCalibration, recordOutcome };
