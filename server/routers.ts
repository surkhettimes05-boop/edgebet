import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  calculateAverageCLV,
  calculateCLV,
  calculateNoBetRespectRate,
  calculatePnL,
  calculateROI,
  calculateWarningOverrideRate,
  calculateWinRate,
  detectRapidBetting,
  detectStakeEscalation,
} from "./analytics";
import { analyzeMatchRisks } from "./adversarialAnalysis";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Matches router
  matches: router({
    list: publicProcedure
      .input(
        z.object({
          status: z.enum(["scheduled", "live", "completed", "cancelled"]).optional(),
          leagueId: z.number().optional(),
          limit: z.number().default(50),
          offset: z.number().default(0),
        })
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        try {
          let query = `
            SELECT m.*, 
              ht.name as homeTeamName, at.name as awayTeamName,
              l.name as leagueName
            FROM matches m
            JOIN teams ht ON m.homeTeamId = ht.id
            JOIN teams at ON m.awayTeamId = at.id
            JOIN leagues l ON m.leagueId = l.id
            WHERE 1=1
          `;
          const params: any[] = [];

          if (input.status) {
            query += " AND m.status = ?";
            params.push(input.status);
          }

          if (input.leagueId) {
            query += " AND m.leagueId = ?";
            params.push(input.leagueId);
          }

          query += " ORDER BY m.matchDate DESC LIMIT ? OFFSET ?";
          params.push(input.limit, input.offset);

          const [rows] = await db.execute(query, params);
          return rows;
        } catch (error) {
          console.error("Error fetching matches:", error);
          return [];
        }
      }),

    get: publicProcedure.input(z.number()).query(async ({ input: matchId }) => {
      const db = await getDb();
      if (!db) return null;

      try {
        const [rows] = await db.execute(
          `
          SELECT m.*, 
            ht.name as homeTeamName, at.name as awayTeamName,
            l.name as leagueName
          FROM matches m
          JOIN teams ht ON m.homeTeamId = ht.id
          JOIN teams at ON m.awayTeamId = at.id
          JOIN leagues l ON m.leagueId = l.id
          WHERE m.id = ?
        `,
          [matchId]
        );
        return rows[0] || null;
      } catch (error) {
        console.error("Error fetching match:", error);
        return null;
      }
    }),
  }),

  // Odds snapshots router
  odds: router({
    getLatest: publicProcedure.input(z.number()).query(async ({ input: matchId }) => {
      const db = await getDb();
      if (!db) return [];

      try {
        const [rows] = await db.execute(
          `
          SELECT os.*, b.name as bookmakername
          FROM odds_snapshots os
          JOIN bookmakers b ON os.bookmakerId = b.id
          WHERE os.matchId = ?
          ORDER BY os.timestamp DESC
          LIMIT 5
        `,
          [matchId]
        );
        return rows;
      } catch (error) {
        console.error("Error fetching odds:", error);
        return [];
      }
    }),
  }),

  // Model predictions router
  predictions: router({
    get: publicProcedure.input(z.number()).query(async ({ input: matchId }) => {
      const db = await getDb();
      if (!db) return null;

      try {
        const [rows] = await db.execute(
          "SELECT * FROM model_predictions WHERE matchId = ? ORDER BY createdAt DESC LIMIT 1",
          [matchId]
        );
        return rows[0] || null;
      } catch (error) {
        console.error("Error fetching prediction:", error);
        return null;
      }
    }),

    update: protectedProcedure
      .input(
        z.object({
          matchId: z.number(),
          evScore: z.number().optional(),
          predictionOutput: z.string().optional(),
          riskNotes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        try {
          const [result] = await db.execute(
            `
            UPDATE model_predictions
            SET evScore = COALESCE(?, evScore),
                predictionOutput = COALESCE(?, predictionOutput),
                riskNotes = COALESCE(?, riskNotes),
                updatedAt = NOW()
            WHERE matchId = ?
          `,
            [input.evScore, input.predictionOutput, input.riskNotes, input.matchId]
          );
          return result;
        } catch (error) {
          console.error("Error updating prediction:", error);
          throw error;
        }
      }),
  }),

  // Tracked bets router
  trackedBets: router({
    list: protectedProcedure
      .input(
        z.object({
          result: z.enum(["pending", "won", "lost", "void"]).optional(),
          limit: z.number().default(50),
          offset: z.number().default(0),
        })
      )
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];

        try {
          let query = `
            SELECT tb.*, m.matchDate, ht.name as homeTeamName, at.name as awayTeamName,
              b.name as bookmakername
            FROM tracked_bets tb
            JOIN matches m ON tb.matchId = m.id
            JOIN teams ht ON m.homeTeamId = ht.id
            JOIN teams at ON m.awayTeamId = at.id
            JOIN bookmakers b ON tb.bookmakerId = b.id
            WHERE tb.userId = ?
          `;
          const params: any[] = [ctx.user.id];

          if (input.result) {
            query += " AND tb.result = ?";
            params.push(input.result);
          }

          query += " ORDER BY tb.createdAt DESC LIMIT ? OFFSET ?";
          params.push(input.limit, input.offset);

          const [rows] = await db.execute(query, params);
          return rows;
        } catch (error) {
          console.error("Error fetching tracked bets:", error);
          return [];
        }
      }),

    create: protectedProcedure
      .input(
        z.object({
          matchId: z.number(),
          bookmakerId: z.number(),
          betType: z.enum(["home_win", "draw", "away_win", "over_under", "both_to_score"]),
          oddsTaken: z.number(),
          stake: z.number(),
          evAtEntry: z.number().optional(),
          isNoBetOverride: z.boolean().default(false),
          isWarningOverride: z.boolean().default(false),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        try {
          // Check for rapid betting
          const [recentBets] = await db.execute(
            `
            SELECT createdAt FROM tracked_bets
            WHERE userId = ?
            ORDER BY createdAt DESC
            LIMIT 3
          `,
            [ctx.user.id]
          );

          const rapidBettingFlag = detectRapidBetting(recentBets as any[]) ? 1 : 0;

          // Check for stake escalation
          const [previousBets] = await db.execute(
            `
            SELECT stake, result FROM tracked_bets
            WHERE userId = ?
            ORDER BY createdAt DESC
            LIMIT 2
          `,
            [ctx.user.id]
          );

          const stakeAfterLoss = detectStakeEscalation(input.stake, previousBets as any[]) ? 1 : 0;

          const [result] = await db.execute(
            `
            INSERT INTO tracked_bets (
              userId, matchId, bookmakerId, betType, oddsTaken, stake, evAtEntry,
              isNoBetOverride, isWarningOverride, stakeAfterLoss, rapidBettingFlag
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
            [
              ctx.user.id,
              input.matchId,
              input.bookmakerId,
              input.betType,
              input.oddsTaken,
              input.stake,
              input.evAtEntry || null,
              input.isNoBetOverride ? 1 : 0,
              input.isWarningOverride ? 1 : 0,
              stakeAfterLoss,
              rapidBettingFlag,
            ]
          ) as any[];

          return result;
        } catch (error) {
          console.error("Error creating tracked bet:", error);
          throw error;
        }
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          result: z.enum(["pending", "won", "lost", "void"]).optional(),
          closingOdds: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        try {
          // Get current bet
          const [bets] = await db.execute(
            "SELECT * FROM tracked_bets WHERE id = ? AND userId = ?",
            [input.id, ctx.user.id]
          );

          if (!bets || bets.length === 0) {
            throw new Error("Bet not found");
          }

          const bet = bets[0] as any;
          let clv = null;
          let pnl = null;

          if (input.closingOdds) {
            clv = calculateCLV(bet.oddsTaken, input.closingOdds);
          }

          if (input.result) {
            pnl = calculatePnL(bet.stake, input.result, bet.oddsTaken);
          }

          const [result] = await db.execute(
            `
            UPDATE tracked_bets
            SET result = COALESCE(?, result),
                closingOdds = COALESCE(?, closingOdds),
                clv = COALESCE(?, clv),
                pnl = COALESCE(?, pnl),
                updatedAt = NOW()
            WHERE id = ?
          `,
            [input.result || null, input.closingOdds || null, clv, pnl, input.id]
          ) as any[];

          return result;
        } catch (error) {
          console.error("Error updating tracked bet:", error);
          throw error;
        }
      }),
  }),

  // Dashboard stats router
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return null;

      try {
        // Total matches tracked
        const [matchCount] = await db.execute(
          "SELECT COUNT(DISTINCT matchId) as count FROM tracked_bets WHERE userId = ?",
          [ctx.user.id]
        );

        // Total bets
        const [totalBets] = await db.execute(
          "SELECT COUNT(*) as count FROM tracked_bets WHERE userId = ?",
          [ctx.user.id]
        );

        // Active (pending) bets
        const [activeBets] = await db.execute(
          "SELECT COUNT(*) as count FROM tracked_bets WHERE userId = ? AND result = 'pending'",
          [ctx.user.id]
        );

        // Completed bets with P&L
        const [completedBets] = await db.execute(
          `
          SELECT SUM(pnl) as totalPnL, SUM(stake) as totalStake, COUNT(*) as count
          FROM tracked_bets
          WHERE userId = ? AND result IN ('won', 'lost')
        `,
          [ctx.user.id]
        );

        // CLV data
        const [clvData] = await db.execute(
          "SELECT clv FROM tracked_bets WHERE userId = ? AND clv IS NOT NULL",
          [ctx.user.id]
        );

        // Behavioral metrics
        const [allBets] = await db.execute(
          "SELECT * FROM tracked_bets WHERE userId = ? ORDER BY createdAt DESC",
          [ctx.user.id]
        );

        const completed = (completedBets as any[])[0];
        const totalPnL = completed?.totalPnL || 0;
        const totalStake = completed?.totalStake || 0;
        const roi = calculateROI(totalPnL, totalStake);
        const winRate = calculateWinRate(allBets as any[]);
        const avgCLV = calculateAverageCLV(clvData as any[]);

        const noBetOverrides = (allBets as any[]).filter((b) => b.isNoBetOverride).length;
        const warningOverrides = (allBets as any[]).filter((b) => b.isWarningOverride).length;
        const noBetRespectRate = calculateNoBetRespectRate((allBets as any[]).length, noBetOverrides);
        const warningOverrideRate = calculateWarningOverrideRate((allBets as any[]).length, warningOverrides);

        return {
          matchesTracked: (matchCount as any[])[0]?.count || 0,
          totalBets: (totalBets as any[])[0]?.count || 0,
          activeBets: (activeBets as any[])[0]?.count || 0,
          totalPnL,
          totalStake,
          roi,
          winRate,
          avgCLV,
          noBetRespectRate,
          warningOverrideRate,
        };
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        return null;
      }
    }),
  }),

  // Adversarial analysis router
  analysis: router({
    analyzeMatch: publicProcedure
      .input(
        z.object({
          matchId: z.number(),
          homeTeam: z.string(),
          awayTeam: z.string(),
          homeWinProb: z.number().optional(),
          drawProb: z.number().optional(),
          awayWinProb: z.number().optional(),
          confidence: z.number().optional(),
          homeOdds: z.number().optional(),
          drawOdds: z.number().optional(),
          awayOdds: z.number().optional(),
          homeTeamXG: z.number().optional(),
          awayTeamXG: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        try {
          return await analyzeMatchRisks(input);
        } catch (error) {
          console.error("Error analyzing match:", error);
          return {
            riskNotes: "Analysis unavailable",
            marketWarnings: null,
            modelWeaknesses: null,
            uncertaintyFlags: null,
            analysisType: "mock" as const,
          };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
