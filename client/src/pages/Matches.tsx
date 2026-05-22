import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Calendar, TrendingUp } from "lucide-react";
import { format } from "date-fns";

export default function Matches() {
  const { data: matches, isLoading } = trpc.matches.list.useQuery({
    limit: 50,
  });

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
          <p className="text-muted-foreground">No matches available</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-500/20 text-blue-400";
      case "live":
        return "bg-red-500/20 text-red-400";
      case "completed":
        return "bg-green-500/20 text-green-400";
      case "cancelled":
        return "bg-gray-500/20 text-gray-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Matches</h1>
        <p className="text-muted-foreground mt-2">Football matches with odds and model predictions</p>
      </div>

      {/* Matches List */}
      <div className="space-y-4">
        {matches.map((match: any) => (
          <Card key={match.id} className="hover:border-primary/50 transition-colors">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                {/* League and Date */}
                <div className="md:col-span-2">
                  <div className="text-sm text-muted-foreground">{match.leagueName}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {format(new Date(match.matchDate), "MMM d, HH:mm")}
                    </span>
                  </div>
                </div>

                {/* Teams */}
                <div className="md:col-span-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{match.homeTeamName}</span>
                      {match.status === "completed" && (
                        <span className="font-bold text-lg">{match.homeTeamGoals}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{match.awayTeamName}</span>
                      {match.status === "completed" && (
                        <span className="font-bold text-lg">{match.awayTeamGoals}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* xG Data */}
                <div className="md:col-span-2">
                  <div className="text-xs text-muted-foreground mb-1">Expected Goals</div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-sm">{match.homeTeamXG?.toFixed(2)}</span>
                      <span className="text-sm">{match.awayTeamXG?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="md:col-span-2">
                  <Badge className={getStatusColor(match.status)}>{match.status}</Badge>
                </div>

                {/* Action */}
                <div className="md:col-span-2">
                  <Button variant="outline" size="sm" className="w-full">
                    View Analysis
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
