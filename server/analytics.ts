/**
 * Analytics utilities for CLV calculation and behavioral metrics
 */

/**
 * Calculate Closing Line Value (CLV)
 * CLV = (closing odds - opening odds) / opening odds
 * Positive CLV means you got better odds than the market closed at
 */
export function calculateCLV(oddsTaken: number, closingOdds: number): number {
  if (!closingOdds || closingOdds === 0) return 0;
  return ((closingOdds - oddsTaken) / oddsTaken) * 100;
}

/**
 * Calculate P&L for a bet
 */
export function calculatePnL(
  stake: number,
  result: "won" | "lost" | "void" | "pending",
  oddsTaken: number
): number {
  if (result === "won") {
    return stake * (oddsTaken - 1);
  } else if (result === "lost") {
    return -stake;
  } else if (result === "void") {
    return 0;
  }
  return 0; // pending
}

/**
 * Detect if stake was escalated after losses
 * Flag if stake increases >40% after consecutive losses
 */
export function detectStakeEscalation(
  currentStake: number,
  previousBets: Array<{ stake: number; result: "won" | "lost" | "void" | "pending" }>
): boolean {
  if (previousBets.length < 2) return false;

  // Check last 2 bets for consecutive losses
  const recentBets = previousBets.slice(-2);
  const hasConsecutiveLosses = recentBets.every((bet) => bet.result === "lost");

  if (!hasConsecutiveLosses) return false;

  // Check if current stake is >40% higher than average of recent bets
  const avgRecentStake = recentBets.reduce((sum, bet) => sum + bet.stake, 0) / recentBets.length;
  const escalationRatio = (currentStake - avgRecentStake) / avgRecentStake;

  return escalationRatio > 0.4;
}

/**
 * Detect rapid betting frequency
 * Flag if more than 3 bets placed within 1 hour
 */
export function detectRapidBetting(
  bets: Array<{ createdAt: Date }>,
  timeWindowMinutes: number = 60
): boolean {
  if (bets.length < 3) return false;

  const now = new Date();
  const recentBets = bets.filter((bet) => {
    const timeDiff = (now.getTime() - bet.createdAt.getTime()) / (1000 * 60);
    return timeDiff <= timeWindowMinutes;
  });

  return recentBets.length >= 3;
}

/**
 * Calculate no-bet respect rate
 * Percentage of times user honored "no bet" signals from model
 */
export function calculateNoBetRespectRate(
  totalNoBetSignals: number,
  noBetOverrides: number
): number {
  if (totalNoBetSignals === 0) return 100;
  return ((totalNoBetSignals - noBetOverrides) / totalNoBetSignals) * 100;
}

/**
 * Calculate warning override rate
 * Percentage of times user ignored risk warnings
 */
export function calculateWarningOverrideRate(
  totalWarnings: number,
  warningOverrides: number
): number {
  if (totalWarnings === 0) return 0;
  return (warningOverrides / totalWarnings) * 100;
}

/**
 * Calculate average CLV across multiple bets
 */
export function calculateAverageCLV(bets: Array<{ clv: number | null }>): number {
  const validCLVs = bets.filter((bet) => bet.clv !== null).map((bet) => bet.clv as number);
  if (validCLVs.length === 0) return 0;
  return validCLVs.reduce((sum, clv) => sum + clv, 0) / validCLVs.length;
}

/**
 * Calculate ROI (Return on Investment)
 * ROI = (Total Profit / Total Stake) * 100
 */
export function calculateROI(totalProfit: number, totalStake: number): number {
  if (totalStake === 0) return 0;
  return (totalProfit / totalStake) * 100;
}

/**
 * Calculate win rate
 * Percentage of bets that won
 */
export function calculateWinRate(
  bets: Array<{ result: "won" | "lost" | "void" | "pending" }>
): number {
  const completedBets = bets.filter((bet) => bet.result !== "pending");
  if (completedBets.length === 0) return 0;
  const wins = completedBets.filter((bet) => bet.result === "won").length;
  return (wins / completedBets.length) * 100;
}
