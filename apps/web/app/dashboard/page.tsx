"use client";

import React from "react";
import {
  TrendingUp,
  Percent,
  Activity,
  ShieldCheck,
  AlertTriangle,
  Scale
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from "recharts";

import StatCard from "../components/StatCard";
import Panel from "../components/Panel";
import VarianceNotice, { type VarianceEvaluation } from "../../components/analytics/VarianceNotice";
import BehavioralWarning from "../components/BehavioralWarning";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────

const clvTrendData = [
  { date: "05-01", clv: 1.2 },
  { date: "05-03", clv: 1.5 },
  { date: "05-05", clv: -0.4 },
  { date: "05-07", clv: 0.8 },
  { date: "05-09", clv: 2.1 },
  { date: "05-11", clv: 1.7 },
  { date: "05-13", clv: 2.9 },
  { date: "05-15", clv: 2.2 },
  { date: "05-17", clv: 3.1 },
  { date: "05-19", clv: 1.8 },
  { date: "05-21", clv: 4.2 },
  { date: "05-22", clv: 3.8 }
];

const calibrationData = [
  { bin: "50%", predicted: 50, actual: 48 },
  { bin: "55%", predicted: 55, actual: 57 },
  { bin: "60%", predicted: 60, actual: 58 },
  { bin: "65%", predicted: 65, actual: 69 },
  { bin: "70%", predicted: 70, actual: 68 }
];

const roiTrendData = [
  { day: 1, pnl: 0 },
  { day: 3, pnl: -0.8 },
  { day: 5, pnl: -1.6 },
  { day: 7, pnl: -0.9 },
  { day: 10, pnl: -2.3 },
  { day: 13, pnl: -3.1 },
  { day: 16, pnl: -2.7 },
  { day: 19, pnl: -3.8 },
  { day: 22, pnl: -4.4 }
];

const varianceEvaluation: VarianceEvaluation = {
  shouldDisplay: true,
  code: "EXPECTED_VARIANCE_DISCIPLINE_STABLE",
  severity: "info",
  message: [
    "Current outcomes remain within expected variance range.",
    "Decision discipline remains healthy.",
    "No significant evidence of process degradation detected."
  ].join("\n"),
  reasons: {
    clvPositive: true,
    disciplineStable: true,
    roiTemporarilyNegative: true,
    sampleSufficient: true,
    withinVarianceRange: true
  }
};

const pieData = [
  { name: "Compliant", value: 92, color: "#10b981" },
  { name: "Override", value: 8, color: "#f43f5e" }
];

const riskSignals = [
  {
    type: "STAKE_ESCALATION",
    severity: 2,
    message: "Stake size increased by 45% between successive bets on 05-21.",
    detail: "Previous: 1.0u | Current: 1.45u | Match: NBA Celtics vs Heat"
  },
  {
    type: "RAPID_BETTING",
    severity: 1,
    message: "Two bets placed within 4.2 minutes on overlapping markets.",
    detail: "System recommends a 10-minute cooling off period to prevent impulse decisions."
  }
];

export default function DashboardPage() {
  return (
    <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-[#222e3f] pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400 font-mono">
            DECISION ENGINE
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100 font-mono">
            ANALYTICS // OVERVIEW
          </h1>
        </div>
        <div className="text-[11px] font-mono text-slate-500 bg-[#10141d] border border-[#222e3f] px-3 py-1.5 rounded">
          LAST AUDIT RUN: <span className="text-slate-300">2026-05-22 19:45 UTC</span>
        </div>
      </div>

      {/* Variance Alert */}
      <VarianceNotice evaluation={varianceEvaluation} />

      {/* Top metrics row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Decision Score"
          value="92.0%"
          subtitle="User compliance vs suggestions"
          icon={ShieldCheck}
          trend="up"
          trendValue="1.4%"
        />
        <StatCard
          label="Avg CLV"
          value="+3.80%"
          subtitle="Average closing edge capture"
          icon={TrendingUp}
          trend="up"
          trendValue="0.45%"
        />
        <StatCard
          label="Cumulative ROI"
          value="-6.1%"
          subtitle="Net return on staked capital"
          icon={Activity}
          trend="flat"
          trendValue="Within variance"
        />
        <StatCard
          label="Win Rate"
          value="54.2%"
          subtitle="74 bets resolved"
          icon={Percent}
          trend="flat"
          trendValue="0.0%"
        />
      </div>

      {/* Main Grid: Priority order matching requested layout */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        
        {/* 1. Decision Discipline (col-span-4) */}
        <div className="lg:col-span-4 flex">
          <Panel title="1. Decision Discipline" className="w-full">
            <div className="flex flex-col items-center justify-center h-56 relative">
              <ResponsiveContainer width="100%" height={160} minWidth={0} initialDimension={{ width: 0, height: 160 }}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-[38%] text-center">
                <span className="text-xl font-bold font-mono text-emerald-400">92%</span>
                <p className="text-[9px] text-slate-500 uppercase tracking-widest">COMPLIANT</p>
              </div>
              <div className="flex justify-between w-full text-xs border-t border-[#222e3f] pt-3 px-2 font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 bg-emerald-500 rounded-sm" />
                  <span className="text-slate-400">Compliant (68)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 bg-rose-500 rounded-sm" />
                  <span className="text-slate-400">Overrides (6)</span>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        {/* 2. CLV Trend (col-span-8) */}
        <div className="lg:col-span-8 flex">
          <Panel title="2. CLV Trend (30 Days)" className="w-full">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 0, height: 160 }}>
                <LineChart data={clvTrendData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d2836" />
                  <XAxis
                    dataKey="date"
                    stroke="#475569"
                    fontSize={10}
                    fontFamily="JetBrains Mono"
                  />
                  <YAxis
                    stroke="#475569"
                    fontSize={10}
                    fontFamily="JetBrains Mono"
                    tickFormatter={(val) => `${val > 0 ? "+" : ""}${val}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#10141d",
                      borderColor: "#222e3f",
                      color: "#e2e8f0",
                      fontFamily: "JetBrains Mono",
                      fontSize: "11px"
                    }}
                    formatter={(val: number) => [`${val > 0 ? "+" : ""}${val}%`, "CLV"]}
                  />
                  <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="3 3" opacity={0.6} />
                  <Line
                    type="monotone"
                    dataKey="clv"
                    stroke="#0ea5e9"
                    strokeWidth={1.5}
                    dot={{ r: 2, fill: "#0ea5e9" }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        {/* 3. Calibration (col-span-7) */}
        <div className="lg:col-span-7 flex">
          <Panel title="3. Model Probability Calibration" className="w-full">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 0, height: 224 }}>
                <LineChart data={calibrationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d2836" />
                  <XAxis
                    dataKey="bin"
                    stroke="#475569"
                    fontSize={10}
                    fontFamily="JetBrains Mono"
                  />
                  <YAxis
                    stroke="#475569"
                    fontSize={10}
                    fontFamily="JetBrains Mono"
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#10141d",
                      borderColor: "#222e3f",
                      color: "#e2e8f0",
                      fontFamily: "JetBrains Mono",
                      fontSize: "11px"
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="predicted"
                    name="Ideal (Perfect Calibration)"
                    stroke="#475569"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Actual Win Frequency"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    dot={{ r: 3, fill: "#f59e0b" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        {/* 4. Risk Discipline (col-span-5) */}
        <div className="lg:col-span-5 flex">
          <Panel title="4. Risk Discipline & Behavioral Logs" className="w-full">
            <div className="flex flex-col justify-between h-full space-y-4">
              <p className="text-[11px] text-slate-400 leading-normal">
                Continuous audit logs for gambling risk mitigation, loss-chasing patterns, and anomalous stake increases.
              </p>
              <div className="flex-1 overflow-y-auto max-h-[160px]">
                <BehavioralWarning signals={riskSignals} />
              </div>
            </div>
          </Panel>
        </div>

        {/* 5. ROI & PNL Over Time (col-span-12) */}
        <div className="lg:col-span-12">
          <Panel title="5. Cumulative ROI Sparkline (Net Stake Units)">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 0, height: 160 }}>
                <AreaChart data={roiTrendData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d2836" />
                  <XAxis
                    dataKey="day"
                    name="Bet Count"
                    stroke="#475569"
                    fontSize={10}
                    fontFamily="JetBrains Mono"
                    tickFormatter={(val) => `#${val}`}
                  />
                  <YAxis
                    stroke="#475569"
                    fontSize={10}
                    fontFamily="JetBrains Mono"
                    tickFormatter={(val) => `${val > 0 ? "+" : ""}${val}u`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#10141d",
                      borderColor: "#222e3f",
                      color: "#e2e8f0",
                      fontFamily: "JetBrains Mono",
                      fontSize: "11px"
                    }}
                    formatter={(val: number) => [`${val > 0 ? "+" : ""}${val}u`, "Net Profit"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="pnl"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#colorPnl)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}
