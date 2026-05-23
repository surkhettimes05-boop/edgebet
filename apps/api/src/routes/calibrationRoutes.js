const express = require("express");
const { getCalibration, recordOutcome } = require("../controllers/calibrationController");

const router = express.Router();

// Public read — no auth required (calibration is model-level, not user-level)
router.get("/", getCalibration);

// Write requires auth to prevent abuse
const { requireAuth } = require("../middleware/authMiddleware");
router.post("/outcomes", requireAuth, recordOutcome);

module.exports = router;
