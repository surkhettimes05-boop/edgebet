require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { PrismaClient } = require("@prisma/client");
const { scheduleFetchOddsJob, runFetchOddsJob } = require("./jobs/fetchOdds");
const { runGeneratePredictionsJob } = require("./jobs/generatePredictions");
const { auditPrediction } = require("./services/llmAuditor");
const authRoutes = require("./routes/authRoutes");
const betRoutes = require("./routes/betRoutes");
const clvRoutes = require("./routes/clvRoutes");
const calibrationRoutes = require("./routes/calibrationRoutes");

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 4000;
const isProd = process.env.NODE_ENV === "production";

// ─── Security headers ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  if (isProd) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
  next();
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, server-to-server, health checks)
    if (!origin) {
      return callback(null, true);
    }
    // Exact match
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // In development, allow all localhost origins regardless of port
    if (process.env.NODE_ENV !== "production" && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: "256kb" }));
app.use("/auth", authRoutes);
app.use("/bets", betRoutes);
app.use("/clv", clvRoutes);
app.use("/calibration", calibrationRoutes);

async function checkDatabase() {
  if (!process.env.DATABASE_URL) {
    return "unconfigured";
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return "connected";
  } catch (error) {
    return "unavailable";
  }
}

app.get("/health", async (req, res) => {
  const database = await checkDatabase();
  const healthy = database === "connected" || database === "unconfigured";

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    service: "edgebet-api",
    version: process.env.npm_package_version || "0.1.0",
    environment: process.env.NODE_ENV || "development",
    database,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

function isAuthorizedJobRequest(req) {
  const secrets = [process.env.CRON_SECRET, process.env.JOB_SECRET].filter(Boolean);

  if (secrets.length === 0) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = req.get("authorization") || "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const headerToken = req.get("x-job-secret");

  return secrets.includes(bearerToken) || secrets.includes(headerToken);
}

app.get("/jobs/fetch-odds", async (req, res) => {
  if (!isAuthorizedJobRequest(req)) {
    return res.status(401).json({
      status: "UNAUTHORIZED",
      error: "Valid cron secret required."
    });
  }

  try {
    const result = await runFetchOddsJob({ prisma });
    const status = result.skipped ? "SKIPPED" : "OK";

    return res.json({
      status,
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      status: "INTERNAL_ERROR",
      error: error.message
    });
  }
});

app.get("/jobs/generate-predictions", async (req, res) => {
  if (!isAuthorizedJobRequest(req)) {
    return res.status(401).json({
      status: "UNAUTHORIZED",
      error: "Valid cron secret required."
    });
  }

  try {
    const result = await runGeneratePredictionsJob({ prisma });
    const status = result.skipped ? "SKIPPED" : "OK";

    return res.json({
      status,
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      status: "INTERNAL_ERROR",
      error: error.message
    });
  }
});

app.get("/matches", async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.json({
      data: [],
      meta: { source: "database", count: 0 }
    });
  }

  const matches = await prisma.match.findMany({
    orderBy: { startsAt: "asc" },
    include: { league: true, homeTeam: true, awayTeam: true }
  });

  res.json({
    data: matches,
    meta: { source: "database", count: matches.length }
  });
});

app.get("/matches/:id", async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ status: "DB_UNCONFIGURED", error: "Database not configured." });
  }

  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        league: true,
        homeTeam: true,
        awayTeam: true,
        oddsSnapshots: {
          orderBy: { capturedAt: "asc" },
          include: { bookmaker: true }
        },
        modelPredictions: {
          orderBy: { createdAt: "desc" },
          take: 50
        }
      }
    });

    if (!match) {
      return res.status(404).json({ status: "NOT_FOUND", error: "Match not found." });
    }

    res.json({ status: "OK", data: match });
  } catch (error) {
    res.status(500).json({ status: "INTERNAL_ERROR", error: error.message });
  }
});

app.get("/predictions", async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.json({
      data: [],
      meta: {
        source: "database",
        count: 0,
        note: "Model outputs require persisted records; no synthetic confidence is generated."
      }
    });
  }

  const predictions = await prisma.modelPrediction.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      match: {
        include: {
          league: true,
          homeTeam: true,
          awayTeam: true,
          oddsSnapshots: {
            orderBy: { capturedAt: "desc" },
            include: { bookmaker: true }
          }
        }
      }
    }
  });

  res.json({
    data: predictions,
    meta: {
      source: "database",
      count: predictions.length,
      note: "Model outputs require persisted records; no synthetic confidence is generated."
    }
  });
});

app.post("/audit", async (req, res) => {
  const { prediction, oddsSnapshots, match } = req.body;

  if (!prediction && !match) {
    return res.status(400).json({
      status: "INVALID_INPUT",
      error: "Request body must include at least 'prediction' or 'match'."
    });
  }

  try {
    const result = await auditPrediction({
      prediction: prediction || null,
      oddsSnapshots: Array.isArray(oddsSnapshots) ? oddsSnapshots : [],
      match: match || null
    });

    const httpStatus = result.status === "OK" ? 200
      : result.status === "GUARDRAIL_VIOLATION" ? 422
      : result.status === "LLM_ERROR" ? 502
      : 500;

    res.status(httpStatus).json(result);
  } catch (error) {
    res.status(500).json({
      status: "INTERNAL_ERROR",
      error: error.message
    });
  }
});

if (require.main === module) {
  const server = app.listen(port, () => {
    console.log(`EdgeBet API listening on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

    if (process.env.ODDS_CRON_ENABLED === "true") {
      scheduleFetchOddsJob();
      console.log("EdgeBet odds ingestion cron scheduled every 15 minutes");
    }
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  // Railway and Render send SIGTERM before killing the container.
  // We stop accepting new connections, let in-flight requests finish,
  // then disconnect Prisma before exiting.
  async function shutdown(signal) {
    console.log(`[shutdown] ${signal} received — draining connections...`);
    server.close(async () => {
      try {
        await prisma.$disconnect();
        console.log("[shutdown] Prisma disconnected. Exiting cleanly.");
      } catch (err) {
        console.error("[shutdown] Prisma disconnect error:", err.message);
      }
      process.exit(0);
    });

    // Force-exit after 10 s if drain stalls
    setTimeout(() => {
      console.error("[shutdown] Drain timeout — forcing exit.");
      process.exit(1);
    }, 10_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
}

// ── Production error handler ───────────────────────────────────────────────
// Must be registered after all routes. Catches any unhandled Express errors.
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const isProdEnv = process.env.NODE_ENV === "production";

  console.error(`[error] ${req.method} ${req.path} →`, err.message);

  res.status(status).json({
    status: "INTERNAL_ERROR",
    error: isProdEnv ? "An unexpected error occurred." : err.message
  });
});

module.exports = { app, prisma };
