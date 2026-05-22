import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, TrendingUp, Zap } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export default function ValueBets() {
  const { data: matches, isLoading } = trpc.matches.list.useQuery({
    limit: 50,
  });

  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);

  // Mock EV calculation for demonstration
  const calculateEV = (modelProb: number, odds: number): number => {
    const impliedProb = 1 / odds;
    return ((modelProb - impliedProb) / impliedProb) * 100;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No value bets identified</p>
        </div>
      </div>
    );
  }

  // Filter for positive EV opportunities (mock data)
  const valueBets = matches
    .filter((match: any) => match.homeTeamXG && match.awayTeamXG)
    .map((match: any) => ({
      ...match,
      homeEV: calculateEV(0.55, 1.8),
      awayEV: calculateEV(0.35, 2.2),
    }))
    .filter((match: any) => match.homeEV > 0 || match.awayEV > 0);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.75) return "bg-green-500/20 text-green-400";
    if (confidence >= 0.6) return "bg-blue-500/20 text-blue-400";
    return "bg-yellow-500/20 text-yellow-400";
  };

  const getEVColor = (ev: number) => {
    if (ev > 10) return "text-green-500";
    if (ev > 5) return "text-green-400";
    if (ev > 0) return "text-blue-400";
    return "text-red-500";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Value Bets</h1>
        <p className="text-muted-foreground mt-2">
          Opportunities where model probability exceeds implied bookmaker probability
        </p>
      </div>

      {/* Value Bets List */}
      {valueBets.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Zap className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No positive EV opportunities currently identified</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {valueBets.map((bet: any) => (
            <Card key={bet.id} className="border-green-500/20 hover:border-green-500/50 transition-colors">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Match Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">{bet.leagueName}</div>
                      <div className="font-semibold text-lg">
                        {bet.homeTeamName} vs {bet.awayTeamName}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(bet.matchDate), "MMM d, yyyy HH:mm")}
                      </div>
                    </div>
                    <Badge className="bg-green-500/20 text-green-400">Value Identified</Badge>
                  </div>

                  {/* EV Opportunities */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Home Win EV */}
                    {bet.homeEV > 0 && (
                      <div className="border border-green-500/30 rounded-lg p-4 bg-green-500/5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold">{bet.homeTeamName} Win</span>
                          <span className={`font-bold text-lg ${getEVColor(bet.homeEV)}`}>
                            +{bet.homeEV.toFixed(1)}% EV
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <div className="text-muted-foreground text-xs">Model Prob</div>
                            <div className="font-semibold">55.0%</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Implied Prob</div>
                            <div className="font-semibold">55.6%</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Odds</div>
                            <div className="font-semibold">1.80</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Away Win EV */}
                    {bet.awayEV > 0 && (
                      <div className="border border-green-500/30 rounded-lg p-4 bg-green-500/5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold">{bet.awayTeamName} Win</span>
                          <span className={`font-bold text-lg ${getEVColor(bet.awayEV)}`}>
                            +{bet.awayEV.toFixed(1)}% EV
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <div className="text-muted-foreground text-xs">Model Prob</div>
                            <div className="font-semibold">35.0%</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Implied Prob</div>
                            <div className="font-semibold">45.5%</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Odds</div>
                            <div className="font-semibold">2.20</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Risk Analysis Section */}
                  <div className="border-t border-gray-700 pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="font-semibold text-sm">Risk Analysis</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <div className="text-muted-foreground text-xs mb-1">Key Risks</div>
                        <p className="text-sm">
                          Recent xG inflated by weak opposition. Late market movement contradicts model direction.
                        </p>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs mb-1">Model Weaknesses</div>
                        <p className="text-sm">Limited historical data for this matchup. Tactical changes not reflected.</p>
                      </div>
                    </div>
                  </div>

                  {/* Match Stats */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground text-xs">Home xG</div>
                      <div className="font-semibold">{bet.homeTeamXG?.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Away xG</div>
                      <div className="font-semibold">{bet.awayTeamXG?.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button className="flex-1" size="sm">
                      Track Bet
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            About Expected Value
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Expected Value (EV) is the mathematical advantage of a bet. Positive EV means the odds are in your favor
            compared to the model's probability assessment. Over time, betting only positive EV opportunities leads to
            long-term profitability.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
