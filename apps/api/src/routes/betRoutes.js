const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const {
  listBets,
  getBet,
  createBet,
  updateBet,
  settleBet,
  deleteBet
} = require("../controllers/betController");

const router = express.Router();

// All bet routes require authentication
router.use(requireAuth);

router.get("/", listBets);
router.post("/", createBet);
router.get("/:id", getBet);
router.patch("/:id", updateBet);
router.patch("/:id/settle", settleBet);
router.delete("/:id", deleteBet);

module.exports = router;
