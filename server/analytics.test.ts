import { describe, expect, it } from "vitest";
import {
  calculateCLV,
  calculatePnL,
  detectStakeEscalation,
  detectRapidBetting,
  calculateNoBetRespectRate,
  calculateWarningOverrideRate,
  calculateAverageCLV,
  calculateROI,
  calculateWinRate,
} from "./analytics";

describe("CLV Calculations", () => {
  it("should calculate positive CLV when closing odds are better", () => {
    const clv = calculateCLV(2.0, 2.5);
    expect(clv).toBe(25); // (2.5 - 2.0) / 2.0 * 100 = 25%
  });

  it("should calculate negative CLV when closing odds are worse", () => {
    const clv = calculateCLV(2.0, 1.5);
    expect(clv).toBe(-25); // (1.5 - 2.0) / 2.0 * 100 = -25%
  });

  it("should return 0 CLV when closing odds are same", () => {
    const clv = calculateCLV(2.0, 2.0);
    expect(clv).toBe(0);
  });

  it("should handle zero closing odds", () => {
    const clv = calculateCLV(2.0, 0);
    expect(clv).toBe(0);
  });
});

describe("P&L Calculations", () => {
  it("should calculate profit for won bet", () => {
    const pnl = calculatePnL(100, "won", 2.0);
    expect(pnl).toBe(100); // 100 * (2.0 - 1) = 100
  });

  it("should calculate loss for lost bet", () => {
    const pnl = calculatePnL(100, "lost", 2.0);
    expect(pnl).toBe(-100);
  });

  it("should return 0 for void bet", () => {
    const pnl = calculatePnL(100, "void", 2.0);
    expect(pnl).toBe(0);
  });

  it("should return 0 for pending bet", () => {
    const pnl = calculatePnL(100, "pending", 2.0);
    expect(pnl).toBe(0);
  });
});

describe("Behavioral Metrics", () => {
  it("should detect stake escalation after consecutive losses", () => {
    const previousBets = [
      { stake: 100, result: "lost" as const },
      { stake: 100, result: "lost" as const },
    ];
    const escalated = detectStakeEscalation(150, previousBets);
    expect(escalated).toBe(true); // 50% increase after losses
  });

  it("should not flag stake increase without consecutive losses", () => {
    const previousBets = [
      { stake: 100, result: "won" as const },
      { stake: 100, result: "lost" as const },
    ];
    const escalated = detectStakeEscalation(150, previousBets);
    expect(escalated).toBe(false);
  });

  it("should not flag small stake increase after losses", () => {
    const previousBets = [
      { stake: 100, result: "lost" as const },
      { stake: 100, result: "lost" as const },
    ];
    const escalated = detectStakeEscalation(120, previousBets);
    expect(escalated).toBe(false); // 20% increase is below 40% threshold
  });

  it("should detect rapid betting (3+ bets within 1 hour)", () => {
    const now = new Date();
    const bets = [
      { createdAt: new Date(now.getTime() - 5 * 60 * 1000) },
      { createdAt: new Date(now.getTime() - 10 * 60 * 1000) },
      { createdAt: new Date(now.getTime() - 15 * 60 * 1000) },
    ];
    const rapid = detectRapidBetting(bets);
    expect(rapid).toBe(true);
  });

  it("should not flag rapid betting with fewer than 3 bets", () => {
    const now = new Date();
    const bets = [
      { createdAt: new Date(now.getTime() - 5 * 60 * 1000) },
      { createdAt: new Date(now.getTime() - 10 * 60 * 1000) },
    ];
    const rapid = detectRapidBetting(bets);
    expect(rapid).toBe(false);
  });

  it("should not flag rapid betting outside time window", () => {
    const now = new Date();
    const bets = [
      { createdAt: new Date(now.getTime() - 5 * 60 * 1000) },
      { createdAt: new Date(now.getTime() - 90 * 60 * 1000) },
      { createdAt: new Date(now.getTime() - 120 * 60 * 1000) },
    ];
    const rapid = detectRapidBetting(bets);
    expect(rapid).toBe(false);
  });
});

describe("Discipline Metrics", () => {
  it("should calculate no-bet respect rate", () => {
    const rate = calculateNoBetRespectRate(10, 2);
    expect(rate).toBe(80); // 8/10 = 80%
  });

  it("should return 100% when no overrides", () => {
    const rate = calculateNoBetRespectRate(10, 0);
    expect(rate).toBe(100);
  });

  it("should return 100% when no signals", () => {
    const rate = calculateNoBetRespectRate(0, 0);
    expect(rate).toBe(100);
  });

  it("should calculate warning override rate", () => {
    const rate = calculateWarningOverrideRate(10, 3);
    expect(rate).toBe(30); // 3/10 = 30%
  });

  it("should return 0% when no overrides", () => {
    const rate = calculateWarningOverrideRate(10, 0);
    expect(rate).toBe(0);
  });
});

describe("Portfolio Metrics", () => {
  it("should calculate average CLV", () => {
    const bets = [{ clv: 5 }, { clv: 10 }, { clv: 15 }];
    const avg = calculateAverageCLV(bets);
    expect(avg).toBe(10);
  });

  it("should ignore null CLVs", () => {
    const bets = [{ clv: 5 }, { clv: null }, { clv: 15 }];
    const avg = calculateAverageCLV(bets as any[]);
    expect(avg).toBe(10);
  });

  it("should return 0 when no valid CLVs", () => {
    const bets = [{ clv: null }, { clv: null }];
    const avg = calculateAverageCLV(bets as any[]);
    expect(avg).toBe(0);
  });

  it("should calculate ROI correctly", () => {
    const roi = calculateROI(500, 1000);
    expect(roi).toBe(50); // 500/1000 * 100 = 50%
  });

  it("should return 0 ROI with zero stake", () => {
    const roi = calculateROI(500, 0);
    expect(roi).toBe(0);
  });

  it("should calculate win rate", () => {
    const bets = [
      { result: "won" as const },
      { result: "won" as const },
      { result: "lost" as const },
      { result: "lost" as const },
    ];
    const rate = calculateWinRate(bets);
    expect(rate).toBe(50);
  });

  it("should exclude pending bets from win rate", () => {
    const bets = [
      { result: "won" as const },
      { result: "lost" as const },
      { result: "pending" as const },
    ];
    const rate = calculateWinRate(bets);
    expect(rate).toBe(50); // 1/2 = 50%
  });

  it("should return 0 win rate with no completed bets", () => {
    const bets = [{ result: "pending" as const }];
    const rate = calculateWinRate(bets);
    expect(rate).toBe(0);
  });
});
