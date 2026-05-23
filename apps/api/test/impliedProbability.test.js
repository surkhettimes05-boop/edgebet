const {
  americanToDecimal,
  calculateBookmakerMargin,
  impliedProbabilityFromAmerican
} = require("../src/utils/impliedProbability");

describe("implied probability utilities", () => {
  test("converts positive American odds into decimal odds and implied probability", () => {
    expect(americanToDecimal(150)).toBe(2.5);
    expect(impliedProbabilityFromAmerican(150)).toBeCloseTo(0.4, 6);
  });

  test("converts negative American odds into decimal odds and implied probability", () => {
    expect(americanToDecimal(-120)).toBeCloseTo(1.833333, 6);
    expect(impliedProbabilityFromAmerican(-120)).toBeCloseTo(0.545455, 6);
  });

  test("calculates bookmaker margin from a market's outcomes", () => {
    const margin = calculateBookmakerMargin([
      { priceAmerican: -110 },
      { priceAmerican: -110 }
    ]);

    expect(margin).toBeCloseTo(0.047619, 6);
  });
});
