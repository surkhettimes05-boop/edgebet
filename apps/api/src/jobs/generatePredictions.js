require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { generatePredictions } = require("../services/predictionService");

let prisma;

async function runGeneratePredictionsJob(options = {}) {
  if (!process.env.DATABASE_URL) {
    return {
      skipped: true,
      error: "DATABASE_URL is not configured."
    };
  }

  const client = options.prisma || getPrisma();
  const result = await generatePredictions({
    prisma: client,
    now: options.now
  });

  console.log(
    `[predictions] generated=${result.generatedPredictions} stored=${result.storedPredictions} matches=${result.matches}`
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

if (require.main === module) {
  runGeneratePredictionsJob()
    .then(disconnectPrisma)
    .catch(async (error) => {
      console.error(`[predictions] generation failed: ${error.message}`);
      await disconnectPrisma();
      process.exitCode = 1;
    });
}

module.exports = {
  runGeneratePredictionsJob
};
