function americanToDecimal(priceAmerican) {
  assertAmericanPrice(priceAmerican);

  if (priceAmerican > 0) {
    return roundDecimal(priceAmerican / 100 + 1, 6);
  }

  return roundDecimal(100 / Math.abs(priceAmerican) + 1, 6);
}

function impliedProbabilityFromAmerican(priceAmerican) {
  assertAmericanPrice(priceAmerican);

  return roundDecimal(rawImpliedProbability(priceAmerican), 6);
}

function rawImpliedProbability(priceAmerican) {
  if (priceAmerican > 0) {
    return 100 / (priceAmerican + 100);
  }

  return Math.abs(priceAmerican) / (Math.abs(priceAmerican) + 100);
}

function calculateBookmakerMargin(outcomes) {
  if (!Array.isArray(outcomes) || outcomes.length === 0) {
    return 0;
  }

  const totalImplied = outcomes.reduce((sum, outcome) => {
    assertAmericanPrice(outcome.priceAmerican);
    return sum + rawImpliedProbability(outcome.priceAmerican);
  }, 0);

  return roundDecimal(Math.max(totalImplied - 1, 0), 6);
}

function roundDecimal(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function assertAmericanPrice(priceAmerican) {
  if (!Number.isFinite(priceAmerican) || priceAmerican === 0) {
    throw new Error("American odds must be a non-zero number.");
  }
}

module.exports = {
  americanToDecimal,
  calculateBookmakerMargin,
  impliedProbabilityFromAmerican
};
