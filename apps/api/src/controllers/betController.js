/**
 * betController.js
 * CRUD + lifecycle handlers for TrackedBet records.
 *
 * Routes:
 *   GET    /bets              — list all bets for authenticated user
 *   POST   /bets              — create a new tracked bet
 *   GET    /bets/:id          — get single bet
 *   PATCH  /bets/:id          — edit bet (pre-settlement fields)
 *   PATCH  /bets/:id/settle   — close/settle a bet (set outcome + closing odds)
 *   DELETE /bets/:id          — soft-delete (void) a bet
 */

const { PrismaClient } = require("@prisma/client");
const {
  computeEvAtEntry,
  computePnl,
  computeSummaryStats,
  resolveDecimalPrice
} = require("../services/betTracker");
const { americanToDecimal } = require("../utils/impliedProbability");
const prisma = new PrismaClient();

// ─── Allowed enum values ──────────────────────────────────────────────────────

const VALID_MARKETS = ["MONEYLINE", "SPREAD", "TOTAL", "PLAYER_PROP", "BTTS"];
const VALID_STATUSES = ["TRACKED", "PLACED", "WON", "LOST", "PUSH", "VOID"];
const SETTLE_STATUSES = ["WON", "LOST", "PUSH", "VOID"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Enrich a raw TrackedBet DB record with computed fields:
 * pnl, clvPct (from latest ClvHistory entry), evAtEntry.
 */
function enrichBet(bet) {
  const priceDecimal = Number(bet.priceDecimal);
  const stakeUnits = Number(bet.stakeUnits);

  const pnl = computePnl({
    status: bet.status,
    stakeUnits,
    priceDecimal
  });

  // Latest CLV entry (if any)
  const latestClv =
    bet.clvHistory && bet.clvHistory.length > 0
      ? bet.clvHistory[bet.clvHistory.length - 1]
      : null;

  const clvPct = latestClv ? Number(latestClv.clvPct) : null;
  const closingPriceDecimal = latestClv ? Number(latestClv.closingPrice) : null;

  return {
    ...bet,
    priceDecimal,
    stakeUnits,
    pnl,
    clvPct,
    closingPriceDecimal,
    evAtEntry: bet.evAtEntry != null ? Number(bet.evAtEntry) : null
  };
}

// ─── LIST ─────────────────────────────────────────────────────────────────────

async function listBets(req, res) {
  const userId = req.user.id;

  try {
    const bets = await prisma.trackedBet.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        clvHistory: { orderBy: { measuredAt: "asc" } },
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
            league: true
          }
        },
        bookmaker: true
      }
    });

    const enriched = bets.map(enrichBet);
    const stats = computeSummaryStats(
      enriched.map((b) => ({
        status: b.status,
        stakeUnits: b.stakeUnits,
        priceDecimal: b.priceDecimal,
        clvPct: b.clvPct
      }))
    );

    return res.status(200).json({
      status: "OK",
      data: enriched,
      stats
    });
  } catch (error) {
    console.error("LIST_BETS ERROR:", error);
    return res.status(500).json({ status: "INTERNAL_ERROR", error: error.message });
  }
}

// ─── GET ONE ──────────────────────────────────────────────────────────────────

async function getBet(req, res) {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const bet = await prisma.trackedBet.findFirst({
      where: { id, userId },
      include: {
        clvHistory: { orderBy: { measuredAt: "asc" } },
        match: { include: { homeTeam: true, awayTeam: true, league: true } },
        bookmaker: true
      }
    });

    if (!bet) {
      return res.status(404).json({ status: "NOT_FOUND", error: "Bet not found." });
    }

    return res.status(200).json({ status: "OK", data: enrichBet(bet) });
  } catch (error) {
    console.error("GET_BET ERROR:", error);
    return res.status(500).json({ status: "INTERNAL_ERROR", error: error.message });
  }
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

async function createBet(req, res) {
  const userId = req.user.id;
  const {
    // Match identification — either a matchId (FK) or free-text description
    matchId,
    matchDescription,   // free-text: "Celtics vs Heat"
    leagueName,         // free-text league label
    // Bet details
    market,
    selection,
    stakeUnits,
    priceAmerican,
    priceDecimal: priceDecimalRaw,
    bookmakerName,
    // Optional model inputs for EV
    modelFairProbability,
    // Timestamps
    placedAt
  } = req.body;

  // ── Validation ──
  if (!market || !VALID_MARKETS.includes(market)) {
    return res.status(400).json({
      status: "INVALID_INPUT",
      error: `market must be one of: ${VALID_MARKETS.join(", ")}`
    });
  }
  if (!selection || typeof selection !== "string" || !selection.trim()) {
    return res.status(400).json({ status: "INVALID_INPUT", error: "selection is required." });
  }
  if (stakeUnits == null || isNaN(Number(stakeUnits)) || Number(stakeUnits) <= 0) {
    return res.status(400).json({ status: "INVALID_INPUT", error: "stakeUnits must be a positive number." });
  }
  if (priceAmerican == null && priceDecimalRaw == null) {
    return res.status(400).json({ status: "INVALID_INPUT", error: "Either priceAmerican or priceDecimal is required." });
  }

  // ── Resolve prices ──
  let priceDecimal = resolveDecimalPrice(priceDecimalRaw, priceAmerican);
  if (!priceDecimal || priceDecimal <= 1) {
    return res.status(400).json({ status: "INVALID_INPUT", error: "Decimal odds must be greater than 1.0." });
  }

  let resolvedPriceAmerican = priceAmerican != null ? Number(priceAmerican) : null;
  if (resolvedPriceAmerican == null && priceDecimal != null) {
    // Convert decimal → American for storage
    resolvedPriceAmerican = decimalToAmerican(priceDecimal);
  }

  // ── EV at entry ──
  const evAtEntry = computeEvAtEntry({
    modelFairProbability: modelFairProbability != null ? Number(modelFairProbability) : null,
    entryPriceDecimal: priceDecimal
  });

  try {
    // ── Resolve or create bookmaker ──
    let bookmakerId = null;
    if (bookmakerName && bookmakerName.trim()) {
      const bm = await prisma.bookmaker.upsert({
        where: { externalId: bookmakerName.trim().toLowerCase() },
        update: {},
        create: {
          name: bookmakerName.trim(),
          externalId: bookmakerName.trim().toLowerCase()
        }
      });
      bookmakerId = bm.id;
    }

    // ── Resolve matchId ──
    // If no matchId provided, create a minimal match record from free-text
    let resolvedMatchId = matchId || null;
    if (!resolvedMatchId) {
      if (!matchDescription || !matchDescription.trim()) {
        return res.status(400).json({
          status: "INVALID_INPUT",
          error: "Either matchId or matchDescription is required."
        });
      }

      // Upsert a placeholder league
      const league = await prisma.league.upsert({
        where: { externalId: `manual:${(leagueName || "MANUAL").trim().toLowerCase()}` },
        update: {},
        create: {
          name: (leagueName || "Manual Entry").trim(),
          sport: "MANUAL",
          externalId: `manual:${(leagueName || "MANUAL").trim().toLowerCase()}`
        }
      });

      // Parse "Home vs Away" or use description as home team name
      const parts = matchDescription.split(/\s+vs\.?\s+/i);
      const homeName = parts[0]?.trim() || matchDescription.trim();
      const awayName = parts[1]?.trim() || "TBD";

      const homeTeam = await prisma.team.upsert({
        where: { externalId: `manual:${homeName.toLowerCase()}` },
        update: {},
        create: { name: homeName, externalId: `manual:${homeName.toLowerCase()}` }
      });
      const awayTeam = await prisma.team.upsert({
        where: { externalId: `manual:${awayName.toLowerCase()}` },
        update: {},
        create: { name: awayName, externalId: `manual:${awayName.toLowerCase()}` }
      });

      const match = await prisma.match.create({
        data: {
          leagueId: league.id,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          startsAt: placedAt ? new Date(placedAt) : new Date(),
          status: "SCHEDULED"
        }
      });
      resolvedMatchId = match.id;
    }

    // ── Create the bet ──
    const bet = await prisma.trackedBet.create({
      data: {
        userId,
        matchId: resolvedMatchId,
        bookmakerId,
        market,
        selection: selection.trim(),
        stakeUnits: Number(stakeUnits),
        priceAmerican: resolvedPriceAmerican,
        priceDecimal,
        evAtEntry,
        status: "TRACKED",
        placedAt: placedAt ? new Date(placedAt) : null
      },
      include: {
        clvHistory: true,
        match: { include: { homeTeam: true, awayTeam: true, league: true } },
        bookmaker: true
      }
    });

    return res.status(201).json({ status: "OK", data: enrichBet(bet) });
  } catch (error) {
    console.error("CREATE_BET ERROR:", error);
    return res.status(500).json({ status: "INTERNAL_ERROR", error: error.message });
  }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

async function updateBet(req, res) {
  const userId = req.user.id;
  const { id } = req.params;
  const {
    market,
    selection,
    stakeUnits,
    priceAmerican,
    priceDecimal: priceDecimalRaw,
    bookmakerName,
    modelFairProbability,
    placedAt,
    status
  } = req.body;

  try {
    const existing = await prisma.trackedBet.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ status: "NOT_FOUND", error: "Bet not found." });
    }

    // Prevent editing already-settled bets (except voiding)
    if (SETTLE_STATUSES.includes(existing.status) && existing.status !== "VOID") {
      return res.status(409).json({
        status: "CONFLICT",
        error: "Settled bets cannot be edited. Use the settle endpoint to update outcomes."
      });
    }

    const updates = {};

    if (market != null) {
      if (!VALID_MARKETS.includes(market)) {
        return res.status(400).json({ status: "INVALID_INPUT", error: `Invalid market: ${market}` });
      }
      updates.market = market;
    }
    if (selection != null) updates.selection = selection.trim();
    if (stakeUnits != null) {
      if (isNaN(Number(stakeUnits)) || Number(stakeUnits) <= 0) {
        return res.status(400).json({ status: "INVALID_INPUT", error: "stakeUnits must be positive." });
      }
      updates.stakeUnits = Number(stakeUnits);
    }
    if (status != null) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ status: "INVALID_INPUT", error: `Invalid status: ${status}` });
      }
      updates.status = status;
    }
    if (placedAt != null) updates.placedAt = new Date(placedAt);

    // Recalculate prices if provided
    if (priceDecimalRaw != null || priceAmerican != null) {
      const newDecimal = resolveDecimalPrice(priceDecimalRaw, priceAmerican);
      if (!newDecimal || newDecimal <= 1) {
        return res.status(400).json({ status: "INVALID_INPUT", error: "Decimal odds must be > 1.0." });
      }
      updates.priceDecimal = newDecimal;
      updates.priceAmerican =
        priceAmerican != null ? Number(priceAmerican) : decimalToAmerican(newDecimal);
    }

    // Recalculate EV if model probability or price changed
    const finalDecimal = updates.priceDecimal ?? Number(existing.priceDecimal);
    const finalModelProb =
      modelFairProbability != null ? Number(modelFairProbability) : null;
    if (finalModelProb != null) {
      updates.evAtEntry = computeEvAtEntry({
        modelFairProbability: finalModelProb,
        entryPriceDecimal: finalDecimal
      });
    }

    // Resolve bookmaker
    if (bookmakerName != null) {
      if (bookmakerName.trim()) {
        const bm = await prisma.bookmaker.upsert({
          where: { externalId: bookmakerName.trim().toLowerCase() },
          update: {},
          create: { name: bookmakerName.trim(), externalId: bookmakerName.trim().toLowerCase() }
        });
        updates.bookmakerId = bm.id;
      } else {
        updates.bookmakerId = null;
      }
    }

    const updated = await prisma.trackedBet.update({
      where: { id },
      data: updates,
      include: {
        clvHistory: { orderBy: { measuredAt: "asc" } },
        match: { include: { homeTeam: true, awayTeam: true, league: true } },
        bookmaker: true
      }
    });

    return res.status(200).json({ status: "OK", data: enrichBet(updated) });
  } catch (error) {
    console.error("UPDATE_BET ERROR:", error);
    return res.status(500).json({ status: "INTERNAL_ERROR", error: error.message });
  }
}

// ─── SETTLE ───────────────────────────────────────────────────────────────────

async function settleBet(req, res) {
  const userId = req.user.id;
  const { id } = req.params;
  const {
    outcome,           // "WON" | "LOST" | "PUSH" | "VOID"
    closingPriceDecimal,
    closingPriceAmerican
  } = req.body;

  if (!outcome || !SETTLE_STATUSES.includes(outcome)) {
    return res.status(400).json({
      status: "INVALID_INPUT",
      error: `outcome must be one of: ${SETTLE_STATUSES.join(", ")}`
    });
  }

  try {
    const existing = await prisma.trackedBet.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ status: "NOT_FOUND", error: "Bet not found." });
    }

    // Resolve closing price
    const closingDecimal = resolveDecimalPrice(closingPriceDecimal, closingPriceAmerican);

    // Compute CLV if closing price provided
    let clvRecord = null;
    if (closingDecimal && closingDecimal > 0) {
      const record = buildClvRecord({
        trackedBetId: id,
        entryDecimal: Number(existing.priceDecimal),
        closingDecimal,
        measuredAt: new Date()
      });

      clvRecord = await prisma.clvHistory.create({
        data: {
          trackedBetId: record.trackedBetId,
          entryPrice: record.entryPrice,
          closingPrice: record.closingPrice,
          clvPct: record.clvPct,
          measuredAt: record.measuredAt
        }
      });
    }

    const settled = await prisma.trackedBet.update({
      where: { id },
      data: { status: outcome },
      include: {
        clvHistory: { orderBy: { measuredAt: "asc" } },
        match: { include: { homeTeam: true, awayTeam: true, league: true } },
        bookmaker: true
      }
    });

    return res.status(200).json({
      status: "OK",
      data: enrichBet(settled),
      clvRecord
    });
  } catch (error) {
    console.error("SETTLE_BET ERROR:", error);
    return res.status(500).json({ status: "INTERNAL_ERROR", error: error.message });
  }
}

// ─── DELETE (void) ────────────────────────────────────────────────────────────

async function deleteBet(req, res) {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const existing = await prisma.trackedBet.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ status: "NOT_FOUND", error: "Bet not found." });
    }

    // Soft-delete: set status to VOID to preserve historical record
    const voided = await prisma.trackedBet.update({
      where: { id },
      data: { status: "VOID" }
    });

    return res.status(200).json({
      status: "OK",
      message: "Bet voided. Historical record preserved.",
      data: { id: voided.id, status: voided.status }
    });
  } catch (error) {
    console.error("DELETE_BET ERROR:", error);
    return res.status(500).json({ status: "INTERNAL_ERROR", error: error.message });
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function decimalToAmerican(decimal) {
  if (decimal >= 2.0) {
    return Math.round((decimal - 1) * 100);
  }
  return Math.round(-100 / (decimal - 1));
}

const { buildClvRecord } = require("../services/clvEngine");

module.exports = {
  listBets,
  getBet,
  createBet,
  updateBet,
  settleBet,
  deleteBet
};
