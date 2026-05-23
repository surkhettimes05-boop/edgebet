-- EdgeBet initial schema migration
-- Generated from prisma/schema.prisma
-- Applied by: prisma migrate deploy

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINAL', 'POSTPONED', 'CANCELLED');
CREATE TYPE "MarketType"  AS ENUM ('MONEYLINE', 'SPREAD', 'TOTAL', 'PLAYER_PROP', 'BTTS');
CREATE TYPE "BetStatus"   AS ENUM ('TRACKED', 'PLACED', 'WON', 'LOST', 'PUSH', 'VOID');
CREATE TYPE "OutcomeResult" AS ENUM ('WIN', 'LOSS', 'PUSH', 'UNRESOLVED');

-- ─── users ────────────────────────────────────────────────────────────────────

CREATE TABLE "users" (
    "id"              TEXT         NOT NULL,
    "email"           TEXT         NOT NULL,
    "name"            TEXT,
    "hashed_password" TEXT         NOT NULL,
    "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"      TIMESTAMPTZ  NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- ─── teams ────────────────────────────────────────────────────────────────────

CREATE TABLE "teams" (
    "id"           TEXT        NOT NULL,
    "name"         TEXT        NOT NULL,
    "abbreviation" TEXT,
    "external_id"  TEXT,
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"   TIMESTAMPTZ NOT NULL,
    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "teams_external_id_key" ON "teams"("external_id");

-- ─── leagues ──────────────────────────────────────────────────────────────────

CREATE TABLE "leagues" (
    "id"          TEXT        NOT NULL,
    "name"        TEXT        NOT NULL,
    "sport"       TEXT        NOT NULL,
    "region"      TEXT,
    "external_id" TEXT,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"  TIMESTAMPTZ NOT NULL,
    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "leagues_external_id_key" ON "leagues"("external_id");

-- ─── matches ──────────────────────────────────────────────────────────────────

CREATE TABLE "matches" (
    "id"           TEXT          NOT NULL,
    "league_id"    TEXT          NOT NULL,
    "home_team_id" TEXT          NOT NULL,
    "away_team_id" TEXT          NOT NULL,
    "starts_at"    TIMESTAMPTZ   NOT NULL,
    "status"       "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "home_score"   INTEGER,
    "away_score"   INTEGER,
    "external_id"  TEXT,
    "created_at"   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    "updated_at"   TIMESTAMPTZ   NOT NULL,
    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "matches_external_id_key" ON "matches"("external_id");
CREATE INDEX "matches_league_id_starts_at_idx" ON "matches"("league_id", "starts_at");
CREATE INDEX "matches_home_team_id_idx"         ON "matches"("home_team_id");
CREATE INDEX "matches_away_team_id_idx"         ON "matches"("away_team_id");

ALTER TABLE "matches"
    ADD CONSTRAINT "matches_league_id_fkey"    FOREIGN KEY ("league_id")    REFERENCES "leagues"("id"),
    ADD CONSTRAINT "matches_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "teams"("id"),
    ADD CONSTRAINT "matches_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "teams"("id");

-- ─── bookmakers ───────────────────────────────────────────────────────────────

CREATE TABLE "bookmakers" (
    "id"          TEXT        NOT NULL,
    "name"        TEXT        NOT NULL,
    "external_id" TEXT,
    "region"      TEXT,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"  TIMESTAMPTZ NOT NULL,
    CONSTRAINT "bookmakers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bookmakers_external_id_key" ON "bookmakers"("external_id");

-- ─── odds_snapshots ───────────────────────────────────────────────────────────

CREATE TABLE "odds_snapshots" (
    "id"               TEXT         NOT NULL,
    "match_id"         TEXT         NOT NULL,
    "bookmaker_id"     TEXT         NOT NULL,
    "market"           "MarketType" NOT NULL,
    "selection"        TEXT         NOT NULL,
    "price_american"   INTEGER      NOT NULL,
    "price_decimal"    DECIMAL(10,4) NOT NULL,
    "implied_prob"     DECIMAL(8,6)  NOT NULL,
    "bookmaker_margin" DECIMAL(8,6)  NOT NULL,
    "captured_at"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT "odds_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX  "odds_snapshots_match_id_market_captured_at_idx"
    ON "odds_snapshots"("match_id", "market", "captured_at");
CREATE INDEX  "odds_snapshots_bookmaker_id_idx"
    ON "odds_snapshots"("bookmaker_id");
CREATE UNIQUE INDEX "odds_snapshots_match_id_bookmaker_id_market_selection_price_american_captured_at_key"
    ON "odds_snapshots"("match_id","bookmaker_id","market","selection","price_american","captured_at");

ALTER TABLE "odds_snapshots"
    ADD CONSTRAINT "odds_snapshots_match_id_fkey"     FOREIGN KEY ("match_id")     REFERENCES "matches"("id"),
    ADD CONSTRAINT "odds_snapshots_bookmaker_id_fkey" FOREIGN KEY ("bookmaker_id") REFERENCES "bookmakers"("id");

-- ─── model_predictions ────────────────────────────────────────────────────────

CREATE TABLE "model_predictions" (
    "id"                TEXT         NOT NULL,
    "match_id"          TEXT         NOT NULL,
    "model_name"        TEXT         NOT NULL,
    "model_version"     TEXT         NOT NULL,
    "market"            "MarketType" NOT NULL,
    "selection"         TEXT         NOT NULL,
    "fair_probability"  DECIMAL(8,6)  NOT NULL,
    "fair_price_decimal" DECIMAL(10,4) NOT NULL,
    "edge_pct"          DECIMAL(8,4)  NOT NULL,
    "rationale"         TEXT,
    "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT "model_predictions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "model_predictions_match_id_market_created_at_idx"
    ON "model_predictions"("match_id", "market", "created_at");

ALTER TABLE "model_predictions"
    ADD CONSTRAINT "model_predictions_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id");

-- ─── tracked_bets ─────────────────────────────────────────────────────────────

CREATE TABLE "tracked_bets" (
    "id"                  TEXT         NOT NULL,
    "user_id"             TEXT,
    "match_id"            TEXT         NOT NULL,
    "bookmaker_id"        TEXT,
    "odds_snapshot_id"    TEXT,
    "model_prediction_id" TEXT,
    "market"              "MarketType" NOT NULL,
    "selection"           TEXT         NOT NULL,
    "stake_units"         DECIMAL(10,4) NOT NULL,
    "price_american"      INTEGER,
    "price_decimal"       DECIMAL(10,4) NOT NULL,
    "ev_at_entry"         DECIMAL(8,6),
    "status"              "BetStatus"  NOT NULL DEFAULT 'TRACKED',
    "placed_at"           TIMESTAMPTZ,
    "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"          TIMESTAMPTZ  NOT NULL,
    CONSTRAINT "tracked_bets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tracked_bets_user_id_created_at_idx" ON "tracked_bets"("user_id", "created_at");
CREATE INDEX "tracked_bets_match_id_idx"            ON "tracked_bets"("match_id");

ALTER TABLE "tracked_bets"
    ADD CONSTRAINT "tracked_bets_user_id_fkey"             FOREIGN KEY ("user_id")             REFERENCES "users"("id"),
    ADD CONSTRAINT "tracked_bets_match_id_fkey"            FOREIGN KEY ("match_id")            REFERENCES "matches"("id"),
    ADD CONSTRAINT "tracked_bets_bookmaker_id_fkey"        FOREIGN KEY ("bookmaker_id")        REFERENCES "bookmakers"("id"),
    ADD CONSTRAINT "tracked_bets_odds_snapshot_id_fkey"    FOREIGN KEY ("odds_snapshot_id")    REFERENCES "odds_snapshots"("id"),
    ADD CONSTRAINT "tracked_bets_model_prediction_id_fkey" FOREIGN KEY ("model_prediction_id") REFERENCES "model_predictions"("id");

-- ─── behavioral_signals ───────────────────────────────────────────────────────

CREATE TABLE "behavioral_signals" (
    "id"             TEXT        NOT NULL,
    "user_id"        TEXT,
    "tracked_bet_id" TEXT,
    "signal_type"    TEXT        NOT NULL,
    "severity"       INTEGER     NOT NULL DEFAULT 1,
    "metadata"       JSONB,
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "behavioral_signals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "behavioral_signals_user_id_created_at_idx" ON "behavioral_signals"("user_id", "created_at");

ALTER TABLE "behavioral_signals"
    ADD CONSTRAINT "behavioral_signals_user_id_fkey"        FOREIGN KEY ("user_id")        REFERENCES "users"("id"),
    ADD CONSTRAINT "behavioral_signals_tracked_bet_id_fkey" FOREIGN KEY ("tracked_bet_id") REFERENCES "tracked_bets"("id");

-- ─── clv_history ──────────────────────────────────────────────────────────────

CREATE TABLE "clv_history" (
    "id"               TEXT          NOT NULL,
    "tracked_bet_id"   TEXT          NOT NULL,
    "odds_snapshot_id" TEXT,
    "closing_price"    DECIMAL(10,4),
    "entry_price"      DECIMAL(10,4) NOT NULL,
    "clv_pct"          DECIMAL(8,4),
    "measured_at"      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT "clv_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "clv_history_tracked_bet_id_measured_at_idx" ON "clv_history"("tracked_bet_id", "measured_at");

ALTER TABLE "clv_history"
    ADD CONSTRAINT "clv_history_tracked_bet_id_fkey"   FOREIGN KEY ("tracked_bet_id")   REFERENCES "tracked_bets"("id"),
    ADD CONSTRAINT "clv_history_odds_snapshot_id_fkey" FOREIGN KEY ("odds_snapshot_id") REFERENCES "odds_snapshots"("id");

-- ─── prediction_outcomes ──────────────────────────────────────────────────────

CREATE TABLE "prediction_outcomes" (
    "id"                   TEXT            NOT NULL,
    "match_id"             TEXT            NOT NULL,
    "model_prediction_id"  TEXT            NOT NULL,
    "result"               "OutcomeResult" NOT NULL,
    "predicted_probability" DECIMAL(8,6),
    "closing_edge_pct"     DECIMAL(8,4),
    "realized_return"      DECIMAL(10,4),
    "evaluated_at"         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT "prediction_outcomes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "prediction_outcomes_model_prediction_id_idx" ON "prediction_outcomes"("model_prediction_id");
CREATE INDEX "prediction_outcomes_match_id_idx"            ON "prediction_outcomes"("match_id");
CREATE INDEX "prediction_outcomes_evaluated_at_idx"        ON "prediction_outcomes"("evaluated_at");

ALTER TABLE "prediction_outcomes"
    ADD CONSTRAINT "prediction_outcomes_match_id_fkey"            FOREIGN KEY ("match_id")            REFERENCES "matches"("id"),
    ADD CONSTRAINT "prediction_outcomes_model_prediction_id_fkey" FOREIGN KEY ("model_prediction_id") REFERENCES "model_predictions"("id");
