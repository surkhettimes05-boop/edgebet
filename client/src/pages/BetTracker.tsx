import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Plus, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export default function BetTracker() {
  const { data: bets, isLoading } = trpc.trackedBets.list.useQuery({
    limit: 100,
  });

  const [showNewBetForm, setShowNewBetForm] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!bets || bets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">No tracked bets yet</p>
        <Button onClick={() => setShowNewBetForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Track First Bet
        </Button>
      </div>
    );
  }

  const getResultColor = (result: string) => {
    switch (result) {
      case "won":
        return "bg-green-500/20 text-green-400";
      case "lost":
        return "bg-red-500/20 text-red-400";
      case "void":
        return "bg-gray-500/20 text-gray-400";
      case "pending":
        return "bg-blue-500/20 text-blue-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  const getBehaviorFlags = (bet: any) => {
    const flags = [];
    if (bet.isNoBetOverride) flags.push("No-Bet Override");
    if (bet.isWarningOverride) flags.push("Warning Override");
    if (bet.stakeAfterLoss) flags.push("Stake Escalation");
    if (bet.rapidBettingFlag) flags.push("Rapid Betting");
    return flags;
  };

  // Calculate summary stats
  const completedBets = bets.filter((b: any) => b.result !== "pending");
  const wonBets = bets.filter((b: any) => b.result === "won");
  const totalPnL = completedBets.reduce((sum: number, b: any) => sum + (b.pnl || 0), 0);
  const avgCLV =
    bets.filter((b: any) => b.clv !== null).reduce((sum: number, b: any) => sum + (b.clv || 0), 0) /
      bets.filter((b: any) => b.clv !== null).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bet Tracker</h1>
          <p className="text-muted-foreground mt-2">Track bets, CLV, and behavioral discipline</p>
        </div>
        <Button onClick={() => setShowNewBetForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Log Bet
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{bets.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{completedBets.length} completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${totalPnL >= 0 ? "text-green-600" : "text-red-600"}`}>
              {totalPnL >= 0 ? "+" : ""}
              {totalPnL.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Win Rate: {completedBets.length > 0 ? ((wonBets.length / completedBets.length) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg CLV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${avgCLV >= 0 ? "text-green-600" : "text-red-600"}`}>
              {avgCLV >= 0 ? "+" : ""}
              {avgCLV.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Closing Line Value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{bets.filter((b: any) => b.result === "pending").length}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting results</p>
          </CardContent>
        </Card>
      </div>

      {/* Bet History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Bet History</CardTitle>
          <CardDescription>All tracked bets with CLV and behavioral flags</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Match</th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Bet Type</th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Odds</th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Stake</th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">CLV</th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">P&L</th>
                  <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Flags</th>
                </tr>
              </thead>
              <tbody>
                {bets.map((bet: any) => {
                  const flags = getBehaviorFlags(bet);
                  return (
                    <tr key={bet.id} className="border-b border-gray-800 hover:bg-gray-900/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold">{bet.homeTeamName}</div>
                        <div className="text-xs text-muted-foreground">{bet.awayTeamName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline">{bet.betType.replace(/_/g, " ")}</Badge>
                      </td>
                      <td className="text-right py-3 px-4 font-mono">{bet.oddsTaken.toFixed(2)}</td>
                      <td className="text-right py-3 px-4 font-mono">${bet.stake.toFixed(2)}</td>
                      <td className="text-right py-3 px-4 font-mono">
                        {bet.clv !== null ? (
                          <span className={bet.clv >= 0 ? "text-green-400" : "text-red-400"}>
                            {bet.clv >= 0 ? "+" : ""}
                            {bet.clv.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="text-right py-3 px-4 font-mono">
                        {bet.pnl !== null ? (
                          <span className={bet.pnl >= 0 ? "text-green-400" : "text-red-400"}>
                            {bet.pnl >= 0 ? "+" : ""}
                            ${bet.pnl.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="text-center py-3 px-4">
                        <Badge className={getResultColor(bet.result)}>{bet.result}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        {flags.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            <span className="text-xs text-yellow-400">{flags.length}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Behavioral Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Behavioral Insights
          </CardTitle>
          <CardDescription>Discipline metrics and risk flags</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-semibold mb-2">Detected Patterns</div>
              <div className="space-y-2 text-sm">
                {bets.some((b: any) => b.isNoBetOverride) && (
                  <div className="flex items-start gap-2 text-yellow-400">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      {bets.filter((b: any) => b.isNoBetOverride).length} no-bet signals overridden
                    </span>
                  </div>
                )}
                {bets.some((b: any) => b.isWarningOverride) && (
                  <div className="flex items-start gap-2 text-yellow-400">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      {bets.filter((b: any) => b.isWarningOverride).length} risk warnings ignored
                    </span>
                  </div>
                )}
                {bets.some((b: any) => b.stakeAfterLoss) && (
                  <div className="flex items-start gap-2 text-red-400">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      {bets.filter((b: any) => b.stakeAfterLoss).length} stake escalations after losses
                    </span>
                  </div>
                )}
                {bets.some((b: any) => b.rapidBettingFlag) && (
                  <div className="flex items-start gap-2 text-orange-400">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      {bets.filter((b: any) => b.rapidBettingFlag).length} rapid betting episodes detected
                    </span>
                  </div>
                )}
                {!bets.some(
                  (b: any) =>
                    b.isNoBetOverride || b.isWarningOverride || b.stakeAfterLoss || b.rapidBettingFlag
                ) && (
                  <div className="text-green-400">
                    <span>✓ No major discipline issues detected</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-2">Recommendations</div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• Focus on CLV rather than win rate for long-term success</p>
                <p>• Respect "no bet" signals from the model - they protect capital</p>
                <p>• Avoid increasing stakes after losses - maintain consistent sizing</p>
                <p>• Take breaks between bets to maintain decision quality</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
