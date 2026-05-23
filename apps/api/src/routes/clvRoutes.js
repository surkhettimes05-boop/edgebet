const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const { getClvAnalytics } = require("../controllers/clvController");

const router = express.Router();

router.use(requireAuth);

// GET /clv — aggregate CLV stats + trend for the authenticated user
router.get("/", getClvAnalytics);

module.exports = router;
