require("dotenv").config();

const cron = require("node-cron");
const { PrismaClient } = require("@prisma/client");
const { ingestOdds } = require("../services/oddsService");

const EVERY_15_MINUTES = "*/15 * * * *";
let prisma;

async function runFetchOddsJob(options = {}) {
  const client = options.prisma || getPrisma();
  const result = await ingestOdds({
    prisma: client,
    apiKey: options.apiKey || process.env.ODDS_API_KEY
  });

  if (result.skipped) {
    console.warn(`[odds] ingestion skipped: ${result.error}`);
    return result;
  }

  console.log(
    `[odds] ingestion successful: fetched=${result.fetchedMatches} normalized=${result.normalizedSnapshots} stored=${result.storedSnapshots}`
  );
  return result;
}

function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient();
  }

  return prisma;
}

async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect();
  }
}

function scheduleFetchOddsJob() {
  return cron.schedule(EVERY_15_MINUTES, () => {
    runFetchOddsJob().catch((error) => {
      console.error(`[odds] ingestion failed: ${error.message}`);
    });
  });
}

if (require.main === module) {
  runFetchOddsJob()
    .then(async () => {
      if (process.env.ODDS_CRON_ENABLED === "true") {
        scheduleFetchOddsJob();
        console.log("[odds] cron scheduled: every 15 minutes");
        return;
      }

      await disconnectPrisma();
    })
    .catch(async (error) => {
      console.error(`[odds] ingestion failed: ${error.message}`);
      await disconnectPrisma();
      process.exitCode = 1;
    });
}

module.exports = {
  EVERY_15_MINUTES,
  runFetchOddsJob,
  scheduleFetchOddsJob
};
