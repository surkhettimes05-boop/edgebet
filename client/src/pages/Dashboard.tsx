import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { AlertCircle, TrendingUp, Target, DollarSign, Zap } from "lucide-react";

export default function Dashboard() {
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Unable to load dashboard data</p>
        </div>
      </div>
    );
  }

  // Sample data for charts (in production, this would come from the backend)
  const clvTrendData = [
    { week: "Week 1", clv: 2.5 },
    { week: "Week 2", clv: 3.1 },
    { week: "Week 3", clv: 1.8 },
    { week: "Week 4", clv: 4.2 },
    { week: "Week 5", clv: 3.5 },
  ];

  const roiData = [
    { month: "Jan", roi: 5 },
    { month: "Feb", roi: 8 },
    { month: "Mar", roi: 3 },
    { month: "Apr", roi: 12 },
    { month: "May", roi: 9 },
  ];

  const disciplineData = [
    { name: "No-Bet Respected", value: stats.noBetRespectRate },
    { name: "No-Bet Overridden", value: 100 - stats.noBetRespectRate },
  ];

  const COLORS = ["#10b981", "#ef4444"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
        <p className="text-muted-foreground mt-2">Track your betting process quality and decision discipline</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalBets}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.activeBets} pending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Total P&L
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${stats.totalPnL >= 0 ? "text-green-600" : "text-red-600"}`}>
              {stats.totalPnL >= 0 ? "+" : ""}
              {stats.totalPnL.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">ROI: {stats.roi.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" /> Avg CLV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${stats.avgCLV >= 0 ? "text-green-600" : "text-red-600"}`}>
              {stats.avgCLV >= 0 ? "+" : ""}
              {stats.avgCLV.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Win Rate: {stats.winRate.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4" /> Discipline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.noBetRespectRate.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground mt-1">No-Bet Respect Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CLV Trend */}
        <Card>
          <CardHeader>
            <CardTitle>CLV Trend</CardTitle>
            <CardDescription>Closing Line Value over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={clvTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="week" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#f3f4f6" }}
                />
                <Line
                  type="monotone"
                  dataKey="clv"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: "#10b981", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ROI Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>ROI Over Time</CardTitle>
            <CardDescription>Return on investment by month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={roiData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#f3f4f6" }}
                />
                <Bar dataKey="roi" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Behavioral Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Discipline */}
        <Card>
          <CardHeader>
            <CardTitle>Decision Discipline</CardTitle>
            <CardDescription>No-Bet Signal Respect</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={disciplineData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {disciplineData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#f3f4f6" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Respected:</span>
                <span className="font-semibold text-green-600">{stats.noBetRespectRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Overridden:</span>
                <span className="font-semibold text-red-600">{(100 - stats.noBetRespectRate).toFixed(1)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Warning Override Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Management</CardTitle>
            <CardDescription>Warning Override Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Warnings Ignored</span>
                  <span className="font-bold">{stats.warningOverrideRate.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-red-600 h-2 rounded-full"
                    style={{ width: `${Math.min(stats.warningOverrideRate, 100)}%` }}
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-gray-700">
                <p className="text-xs text-muted-foreground mb-2">
                  Lower is better. Ignoring warnings indicates overconfidence in the model.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Summary</CardTitle>
            <CardDescription>Key performance indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Matches Tracked</span>
                <span className="font-bold">{stats.matchesTracked}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Win Rate</span>
                <span className="font-bold">{stats.winRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg Stake</span>
                <span className="font-bold">
                  ${stats.totalBets > 0 ? (stats.totalStake / stats.totalBets).toFixed(2) : "0.00"}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                <span className="text-sm text-muted-foreground">Total Stake</span>
                <span className="font-bold">${stats.totalStake.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
