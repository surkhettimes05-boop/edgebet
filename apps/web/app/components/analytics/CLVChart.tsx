"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Legend
} from "recharts";
import { RefreshCw, TrendingUp, BarChart2, Activity, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClvBetRow {
  betId: string;
  match: string | null;
  league: string | null;
  market: string;
  selection: string;
  bookmaker: string | null;
  status: string;
  placedAt: string;
  entryPrice: number;
  closingPrice: number;
  clvProbDelta: number;
  beatingClosingLine: boolean;
  snapshots: Array<{
    id: string;
    entryPrice: number;
    closingPrice: number;
    clvProbDelta: number;
    measuredAt: string;
  }>;
}

interface ClvStats {
  count: number;
  avgClvProbDelta: number | null;
  avgClvOddsRatio: number | null;
  positiveCount: number;
  negativeCount: number;
  positiveRate: number | null;
  maxClv: number | null;
  minClv: number | null;
  trend: Array<{
    date: string;
    clvProbDelta: number;
    clvOddsRatio: number | null;
    cumAvg: number;
  }>;
}

interface ClvData {
  bets: ClvBetRow[];
  stats: ClvStats;
  trend: ClvStats["trend"];
}

type ViewMode = "trend" | "breakdown" | "distribution";

// ─── Tooltip styles ───────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: "#10141d",
  borderColor: "#222e3f",
  color: "#e2e8f0",
  fontFamily: "JetBrains Mono, monospace",
  fontSize: "11px",
  borderRadius: "4px"
};

// ─── Custom Tooltip: Trend ────────────────────────────────────────────────────

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const delta = payload.find((p: any) => p.dataKey === "clvProbDelta");
  const cumAvg = payload.find((p: any) => p.dataKey === "cumAvg");
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 space-y-1 border border-[#222e3f]">
      <p className="text-slate-400 text-[10px]">{label}</p>
      {delta && (
        <p className={delta.value > 0 ? "text-emerald-400" : "text-rose-400"}>
          CLV: {delta.value > 0 ? "+" : ""}{(delta.value * 100).toFixed(3)}pp
        </p>
      )}
      {cumAvg && (
        <p className={cumAvg.value > 0 ? "text-sky-400" : "text-amber-400"}>
          Cum avg: {cumAvg.value > 0 ? "+" : ""}{(cumAvg.value * 100).toFixed(3)}pp
        </p>
      )}
    </div>
  );
}

// ─── Custom Tooltip: Breakdown ────────────────────────────────────────────────

function BreakdownTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 space-y-1 border border-[#222e3f] max-w-[220px]">
      <p className="text-slate-300 font-semibold truncate">{d.label}</p>
      <p className="text-slate-400 text-[10px]">{d.market} — {d.selection}</p>
      <p className={d.clvProbDelta > 0 ? "text-emerald-400" : "text-rose-400"}>
        CLV: {d.clvProbDelta > 0 ? "+" : ""}{(d.clvProbDelta * 100).toFixed(3)}pp
      </p>
      <p className="text-slate-500 text-[10px]">
        Entry: {d.entryPrice.toFixed(3)} → Close: {d.closingPrice.toFixed(3)}
      </p>
    </div>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  positive
}: {
  label: string;
  value: string;
  positive?: boolean | null;
}) {
  const color =
    positive === true
      ? "text-emerald-400"
      : positive === false
      ? "text-rose-400"
      : "text-slate-300";
  return (
    <div className="flex flex-col gap-0.5 bg-[#0c0f16] border border-[#222e3f] rounded px-3 py-2">
      <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500">
        {label}
      </span>
      <span className={`text-sm font-mono font-bold ${color}`}>{value}</span>
    </div>
  );
}

// ─── View toggle button ───────────────────────────────────────────────────────

function ViewBtn({
  active,
  onClick,
  icon: Icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded border transition-colors ${
        active
          ? "bg-sky-500/10 border-sky-500/30 text-sky-400"
          : "border-[#222e3f] text-slate-500 hover:text-slate-300 hover:border-slate-600"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface CLVChartProps {
  /** If provided, renders in standalone mode with its own data fetching */
  standalone?: boolean;
  /** If provided externally (e.g. from parent page), skips internal fetch */
  data?: ClvData;
  className?: string;
}

export default function CLVChart({ standalone = true, data: externalData, className = "" }: CLVChartProps) {
  const { token, isAuthenticated } = useAuth();
  const [data, setData] = useState<ClvData | null>(externalData ?? null);
  const [isLoading, setIsLoading] = useState(standalone && !externalData);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("trend");

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const fetchData = useCallback(async () => {
    if (!isAuthenticated || !token) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/clv`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include"
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load CLV data.");
      setData(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load CLV data.");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, token, API]);

  useEffect(() => {
    if (standalone && !externalData) fetchData();
  }, [standalone, externalData, fetchData]);

  // ── Derived chart data ──

  // Trend view: one point per settled bet, chronological
  const trendData = useMemo(() => {
    if (!data?.trend?.length) return [];
    return data.trend.map((t, i) => ({
      ...t,
      index: i + 1,
      // Convert to percentage points for display
      clvProbDelta: t.clvProbDelta,
      cumAvg: t.cumAvg
    }));
  }, [data]);

  // Breakdown view: one bar per bet
  const breakdownData = useMemo(() => {
    if (!data?.bets?.length) return [];
    return data.bets.map((b, i) => ({
      index: i + 1,
      label: b.match ?? b.selection,
      market: b.market,
      selection: b.selection,
      entryPrice: b.entryPrice,
      closingPrice: b.closingPrice,
      clvProbDelta: b.clvProbDelta,
      status: b.status
    }));
  }, [data]);

  // Distribution view: histogram of CLV prob delta values
  const distributionData = useMemo(() => {
    if (!data?.bets?.length) return [];
    const deltas = data.bets.map((b) => b.clvProbDelta);
    if (deltas.length === 0) return [];

    const min = Math.min(...deltas);
    const max = Math.max(...deltas);
    const range = max - min;
    const binCount = Math.min(10, Math.max(5, Math.ceil(deltas.length / 3)));
    const binWidth = range / binCount || 0.01;

    const bins: Array<{ range: string; count: number; midpoint: number }> = [];
    for (let i = 0; i < binCount; i++) {
      const lo = min + i * binWidth;
      const hi = lo + binWidth;
      const count = deltas.filter((d) => d >= lo && (i === binCount - 1 ? d <= hi : d < hi)).length;
      bins.push({
        range: `${(lo * 100).toFixed(1)}pp`,
        count,
        midpoint: (lo + hi) / 2
      });
    }
    return bins;
  }, [data]);

  const stats = data?.stats;

  // ── Render ──

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-16 gap-2 text-slate-500 font-mono text-xs ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading CLV data...
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/30 rounded px-4 py-3 text-xs text-rose-400 font-mono ${className}`}>
        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        {error}
      </div>
    );
  }

  if (!data || data.bets.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 text-center font-mono ${className}`}>
        <p className="text-slate-500 text-sm">No CLV data yet.</p>
        <p className="text-slate-600 text-xs mt-1">
          Settle bets with closing odds to start tracking CLV.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header row: stats + controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Stat pills */}
        <div className="flex flex-wrap gap-2">
          <StatPill
            label="Avg CLV"
            value={
              stats?.avgClvProbDelta != null
                ? `${stats.avgClvProbDelta > 0 ? "+" : ""}${(stats.avgClvProbDelta * 100).toFixed(3)}pp`
                : "—"
            }
            positive={stats?.avgClvProbDelta != null ? stats.avgClvProbDelta > 0 : null}
          />
          <StatPill
            label="Beat Close"
            value={
              stats?.positiveRate != null
                ? `${(stats.positiveRate * 100).toFixed(1)}%`
                : "—"
            }
            positive={stats?.positiveRate != null ? stats.positiveRate >= 0.5 : null}
          />
          <StatPill
            label="Sample"
            value={stats?.count != null ? `${stats.count}` : "—"}
          />
          <StatPill
            label="Max CLV"
            value={
              stats?.maxClv != null
                ? `+${(stats.maxClv * 100).toFixed(3)}pp`
                : "—"
            }
            positive={true}
          />
          <StatPill
            label="Min CLV"
            value={
              stats?.minClv != null
                ? `${(stats.minClv * 100).toFixed(3)}pp`
                : "—"
            }
            positive={stats?.minClv != null ? stats.minClv > 0 : false}
          />
        </div>

        {/* View toggle + refresh */}
        <div className="flex items-center gap-2 shrink-0">
          <ViewBtn
            active={view === "trend"}
            onClick={() => setView("trend")}
            icon={TrendingUp}
            label="Trend"
          />
          <ViewBtn
            active={view === "breakdown"}
            onClick={() => setView("breakdown")}
            icon={BarChart2}
            label="Per Bet"
          />
          <ViewBtn
            active={view === "distribution"}
            onClick={() => setView("distribution")}
            icon={Activity}
            label="Distribution"
          />
          {standalone && (
            <button
              onClick={fetchData}
              aria-label="Refresh CLV data"
              className="p-1.5 text-slate-500 hover:text-slate-200 border border-[#222e3f] rounded hover:border-slate-600 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Formula note */}
      <p className="text-[10px] font-mono text-slate-600">
        CLV = implied prob at close − implied prob at entry (probability delta, pp).
        Positive = beat the closing line.
      </p>

      {/* ── TREND VIEW ── */}
      {view === "trend" && (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 0, height: 256 }}>
            <LineChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1d2836" />
              <XAxis
                dataKey="index"
                stroke="#475569"
                fontSize={10}
                fontFamily="JetBrains Mono"
                tickFormatter={(v) => `#${v}`}
              />
              <YAxis
                stroke="#475569"
                fontSize={10}
                fontFamily="JetBrains Mono"
                tickFormatter={(v) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}pp`}
              />
              <Tooltip content={<TrendTooltip />} />
              <Legend
                wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: "10px", color: "#64748b" }}
              />
              <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="3 3" opacity={0.5} />
              {/* Per-bet CLV dots */}
              <Line
                type="monotone"
                dataKey="clvProbDelta"
                name="CLV (prob delta)"
                stroke="#0ea5e9"
                strokeWidth={0}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const color = payload.clvProbDelta >= 0 ? "#10b981" : "#f43f5e";
                  return <circle key={props.key} cx={cx} cy={cy} r={4} fill={color} stroke="none" />;
                }}
                activeDot={{ r: 6 }}
              />
              {/* Cumulative average line */}
              <Line
                type="monotone"
                dataKey="cumAvg"
                name="Cumulative avg"
                stroke="#0ea5e9"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="4 2"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── BREAKDOWN VIEW ── */}
      {view === "breakdown" && (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 0, height: 256 }}>
            <BarChart data={breakdownData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1d2836" />
              <XAxis
                dataKey="index"
                stroke="#475569"
                fontSize={10}
                fontFamily="JetBrains Mono"
                tickFormatter={(v) => `#${v}`}
              />
              <YAxis
                stroke="#475569"
                fontSize={10}
                fontFamily="JetBrains Mono"
                tickFormatter={(v) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}pp`}
              />
              <Tooltip content={<BreakdownTooltip />} />
              <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" opacity={0.6} />
              <Bar dataKey="clvProbDelta" name="CLV" maxBarSize={28} radius={[2, 2, 0, 0]}>
                {breakdownData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.clvProbDelta >= 0 ? "#10b981" : "#f43f5e"}
                    fillOpacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── DISTRIBUTION VIEW ── */}
      {view === "distribution" && (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 0, height: 256 }}>
            <BarChart data={distributionData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1d2836" />
              <XAxis
                dataKey="range"
                stroke="#475569"
                fontSize={9}
                fontFamily="JetBrains Mono"
                interval={0}
                angle={-30}
                textAnchor="end"
                height={40}
              />
              <YAxis
                stroke="#475569"
                fontSize={10}
                fontFamily="JetBrains Mono"
                allowDecimals={false}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: number) => [v, "Bets"]}
                labelFormatter={(l) => `CLV bin: ${l}`}
              />
              <ReferenceLine x="0.0pp" stroke="#f43f5e" strokeDasharray="3 3" opacity={0.5} />
              <Bar dataKey="count" name="Bets" maxBarSize={32} radius={[2, 2, 0, 0]}>
                {distributionData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.midpoint >= 0 ? "#10b981" : "#f43f5e"}
                    fillOpacity={0.75}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-bet table (compact, scrollable) */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[11px] font-mono">
          <thead className="bg-[#0c0f16] border-b border-[#222e3f] text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">#</th>
              <th className="px-3 py-2 text-left font-semibold">MATCH</th>
              <th className="px-3 py-2 text-left font-semibold">MARKET</th>
              <th className="px-3 py-2 text-right font-semibold">ENTRY</th>
              <th className="px-3 py-2 text-right font-semibold">CLOSE</th>
              <th className="px-3 py-2 text-right font-semibold">ENTRY PROB</th>
              <th className="px-3 py-2 text-right font-semibold">CLOSE PROB</th>
              <th className="px-3 py-2 text-right font-semibold">CLV (Δpp)</th>
              <th className="px-3 py-2 text-center font-semibold">RESULT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222e3f]/30">
            {data.bets.map((bet, i) => {
              const entryProb = 1 / bet.entryPrice;
              const closeProb = 1 / bet.closingPrice;
              return (
                <tr key={bet.betId} className="hover:bg-[#151b26]/40 transition-colors">
                  <td className="px-3 py-2 text-slate-600">{i + 1}</td>
                  <td className="px-3 py-2 text-slate-300 max-w-[160px] truncate" title={bet.match ?? ""}>
                    {bet.match ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{bet.market}</td>
                  <td className="px-3 py-2 text-right text-slate-300">{bet.entryPrice.toFixed(3)}</td>
                  <td className="px-3 py-2 text-right text-slate-300">{bet.closingPrice.toFixed(3)}</td>
                  <td className="px-3 py-2 text-right text-slate-400">
                    {(entryProb * 100).toFixed(2)}%
                  </td>
                  <td className="px-3 py-2 text-right text-slate-400">
                    {(closeProb * 100).toFixed(2)}%
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-bold ${
                      bet.clvProbDelta > 0 ? "text-emerald-400" : bet.clvProbDelta < 0 ? "text-rose-400" : "text-slate-400"
                    }`}
                  >
                    {bet.clvProbDelta > 0 ? "+" : ""}
                    {(bet.clvProbDelta * 100).toFixed(3)}pp
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${
                        bet.status === "WON"
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          : bet.status === "LOST"
                          ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                          : bet.status === "PUSH"
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          : "bg-slate-900 border-slate-800 text-slate-500"
                      }`}
                    >
                      {bet.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
