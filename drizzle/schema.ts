import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Football leagues (Premier League, La Liga, Serie A, etc.)
 */
export const leagues = mysqlTable("leagues", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  season: varchar("season", { length: 20 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type League = typeof leagues.$inferSelect;
export type InsertLeague = typeof leagues.$inferInsert;

/**
 * Football teams
 */
export const teams = mysqlTable("teams", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  leagueId: int("leagueId").notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Team = typeof teams.$inferSelect;
export type InsertTeam = typeof teams.$inferInsert;

/**
 * Football matches
 */
export const matches = mysqlTable("matches", {
  id: int("id").autoincrement().primaryKey(),
  leagueId: int("leagueId").notNull(),
  homeTeamId: int("homeTeamId").notNull(),
  awayTeamId: int("awayTeamId").notNull(),
  matchDate: timestamp("matchDate").notNull(),
  status: mysqlEnum("status", ["scheduled", "live", "completed", "cancelled"]).default("scheduled").notNull(),
  homeTeamGoals: int("homeTeamGoals"),
  awayTeamGoals: int("awayTeamGoals"),
  homeTeamXG: decimal("homeTeamXG", { precision: 5, scale: 2 }),
  awayTeamXG: decimal("awayTeamXG", { precision: 5, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Match = typeof matches.$inferSelect;
export type InsertMatch = typeof matches.$inferInsert;

/**
 * Bookmakers (Betfair, Pinnacle, DraftKings, etc.)
 */
export const bookmakers = mysqlTable("bookmakers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Bookmaker = typeof bookmakers.$inferSelect;
export type InsertBookmaker = typeof bookmakers.$inferInsert;

/**
 * Odds snapshots - historical record of odds at different times
 */
export const oddsSnapshots = mysqlTable("odds_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").notNull(),
  bookmakerId: int("bookmakerId").notNull(),
  homeOdds: decimal("homeOdds", { precision: 6, scale: 3 }).notNull(),
  drawOdds: decimal("drawOdds", { precision: 6, scale: 3 }).notNull(),
  awayOdds: decimal("awayOdds", { precision: 6, scale: 3 }).notNull(),
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OddsSnapshot = typeof oddsSnapshots.$inferSelect;
export type InsertOddsSnapshot = typeof oddsSnapshots.$inferInsert;

/**
 * Model predictions - output from Python prediction worker
 * Reserved fields for Python worker to populate
 */
export const modelPredictions = mysqlTable("model_predictions", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").notNull(),
  homeWinProb: decimal("homeWinProb", { precision: 5, scale: 4 }),
  drawProb: decimal("drawProb", { precision: 5, scale: 4 }),
  awayWinProb: decimal("awayWinProb", { precision: 5, scale: 4 }),
  confidence: decimal("confidence", { precision: 5, scale: 4 }),
  // Python worker writes these fields
  evScore: decimal("evScore", { precision: 8, scale: 4 }),
  predictionOutput: text("predictionOutput"),
  riskNotes: text("riskNotes"),
  modelVersion: varchar("modelVersion", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ModelPrediction = typeof modelPredictions.$inferSelect;
export type InsertModelPrediction = typeof modelPredictions.$inferInsert;

/**
 * Tracked bets - user's placed bets for CLV tracking and behavioral analysis
 */
export const trackedBets = mysqlTable("tracked_bets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  matchId: int("matchId").notNull(),
  bookmakerId: int("bookmakerId").notNull(),
  betType: mysqlEnum("betType", ["home_win", "draw", "away_win", "over_under", "both_to_score"]).notNull(),
  // Bet entry data
  oddsTaken: decimal("oddsTaken", { precision: 6, scale: 3 }).notNull(),
  stake: decimal("stake", { precision: 10, scale: 2 }).notNull(),
  evAtEntry: decimal("evAtEntry", { precision: 8, scale: 4 }),
  // Bet outcome data
  result: mysqlEnum("result", ["pending", "won", "lost", "void"]).default("pending").notNull(),
  closingOdds: decimal("closingOdds", { precision: 6, scale: 3 }),
  // CLV (Closing Line Value) calculation
  clv: decimal("clv", { precision: 8, scale: 4 }),
  // Profit/Loss
  pnl: decimal("pnl", { precision: 10, scale: 2 }),
  // Behavioral tracking
  isNoBetOverride: int("isNoBetOverride").default(0), // 1 if bet placed despite model "no bet" signal
  isWarningOverride: int("isWarningOverride").default(0), // 1 if bet placed despite risk warning
  stakeAfterLoss: int("stakeAfterLoss").default(0), // 1 if stake increased >40% after recent loss
  rapidBettingFlag: int("rapidBettingFlag").default(0), // 1 if multiple bets within short time window
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TrackedBet = typeof trackedBets.$inferSelect;
export type InsertTrackedBet = typeof trackedBets.$inferInsert;

/**
 * Adversarial analysis notes - LLM-generated risk analysis
 */
export const adversarialAnalysis = mysqlTable("adversarial_analysis", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").notNull(),
  predictionId: int("predictionId"),
  riskNotes: text("riskNotes").notNull(),
  marketWarnings: text("marketWarnings"),
  modelWeaknesses: text("modelWeaknesses"),
  uncertaintyFlags: text("uncertaintyFlags"),
  analysisType: mysqlEnum("analysisType", ["template_based", "llm_generated", "mock"]).default("template_based").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdversarialAnalysis = typeof adversarialAnalysis.$inferSelect;
export type InsertAdversarialAnalysis = typeof adversarialAnalysis.$inferInsert;
