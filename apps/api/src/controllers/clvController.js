/**
 * clvController.js
 *
 * GET /clv
 * Returns aggregate CLV analytics for the authenticated user:
 *   - Per-bet CLV breakdown (prob delta + odds ratio)
 *   - Aggregate stats (avg, positive rate, trend)
 *   - Full historical snapshot array (never truncated)
 *
 * All calculations are deterministic. No synthetic scores.
 */

const { PrismaClient } = require("@prisma/client");
const { aggregateClvStats } = require("../services/clvEngine");

const prisma = new PrismaClient();

async function getClvAnalytics(req, res) {
  const userId = req.user.id;

  try {
    // Fetch all settled bets with their full CLV history
    const bets = await prisma.trackedBet.findMany({
      where: {
        userId,
        status: { in: ["WON", "LOST", "PUSH", "VOID"] }
      },
      orderBy: { createdAt: "asc" },
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

    // Build per-bet CLV rows (only bets that have at least one CLV record)
    const betRows = bets
      .filter((b) => b.clvHistory.length > 0)
      .map((b) => {
        // Use the most recent CLV snapshot as the canonical value
        const latest = b.clvHistory[b.clvHistory.length - 1];
        const allSnapshots = b.clvHistory.map((h) => ({
          id: h.id,
          entryPrice: Number(h.entryPrice),
          closingPrice: Number(h.closingPrice),
          clvProbDelta: Number(h.clvPct),
          measuredAt: h.measuredAt
        }));

        return {
          betId: b.id,
          match: b.match
            ? `${b.match.homeTeam.name} vs ${b.match.awayTeam.name}`
            : null,
          league: b.match?.league?.name ?? null,
          market: b.market,
          selection: b.selection,
          bookmaker: b.bookmaker?.name ?? null,
          status: b.status,
          placedAt: b.placedAt ?? b.createdAt,
          entryPrice: Number(latest.entryPrice),
          closingPrice: Number(latest.closingPrice),
          // Primary metric: probability delta
          clvProbDelta: Number(latest.clvPct),
          beatingClosingLine: Number(latest.clvPct) > 0,
          // All historical snapshots for this bet (preserved)
          snapshots: allSnapshots
        };
      });

    // Flatten all CLV history records for aggregate stats
    const allClvRecords = bets.flatMap((b) =>
      b.clvHistory.map((h) => ({
        clvPct: Number(h.clvPct),
        entryPrice: Number(h.entryPrice),
        closingPrice: Number(h.closingPrice),
        measuredAt: h.measuredAt
      }))
    );

    const stats = aggregateClvStats(allClvRecords);

    return res.status(200).json({
      status: "OK",
      data: {
        bets: betRows,
        stats,
        // Trend array ready for charting (chronological, cumulative avg)
        trend: stats.trend
      },
      meta: {
        totalBetsWithClv: betRows.length,
        totalSnapshots: allClvRecords.length,
        note: "clvProbDelta = impliedProbAtClose - impliedProbAtEntry. Positive = beat closing line."
      }
    });
  } catch (error) {
    console.error("CLV_ANALYTICS ERROR:", error);
    return res.status(500).json({ status: "INTERNAL_ERROR", error: error.message });
  }
}

module.exports = { getClvAnalytics };
