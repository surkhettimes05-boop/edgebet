"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend
} from "recharts";
import { TrendingUp, BarChart2, Percent } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OddsSnapshot {
  id: string;
  market: string;
  selection: string;
  priceDecimal: number;
  impliedProb: number;
  bookmakerMargin: number;
  capturedAt: string;
  bookmaker: { name: string };
}

export interface ModelPrediction {
  id: string;
  market: string;
  selection: string;
  fairProbability: number;
  fairPriceDecimal: number;
  edgePct: number;
  createdAt: string;
}

interface OddsChartProps {
  snapshots: OddsSnapshot[];
  predictions: ModelPrediction[];
  homeTeam: string;
  awayTeam: string;
}

type ChartView = "odds" | "implied" | "ev";
type MarketFilter = "MONEYLINE" | "SPREAD" | "TOTAL" | "BTTS";

// ─── Shared chart config ──────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: "#10141d",
  borderColor: "#222e3f",
  color: "#e2e8f0",
  fontFamily: "JetBrains Mono, monospace",
  fontSize: "11px",
  borderRadius: "4px"
};

const AXIS_PROPS = {
  stroke: "#475569",
  fontSize: 10,
  fontFamily: "JetBrains Mono"
} as const;

// Stable colour palette per bookmaker / selection
const PALETTE = [
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#a78bfa", // violet
  "#f43f5e", // rose
  "#34d399", // green
  "#60a5fa", // blue
];

function colorFor(index: number) {
  return PALETTE[index % PALETTE.length];
}

// ─── View toggle ──────────────────────────────────────────────────────────────

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
      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded border transition-colors ${
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

// ─── Custom tooltips ──────────────────────────────────────────────────────────

function OddsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 space-y-1 border border-[#222e3f] min-w-[160px]">
      <p className="text-slate-400 text-[10px] border-b border-[#222e3f] pb-1 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {Number(p.value).toFixed(3)}
        </p>
      ))}
    </div>
  );
}

function ProbTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 space-y-1 border border-[#222e3f] min-w-[160px]">
      <p className="text-slate-400 text-[10px] border-b border-[#222e3f] pb-1 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {(Number(p.value) * 100).toFixed(2)}%
        </p>
      ))}
    </div>
  );
}

function EvTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 space-y-1 border border-[#222e3f] min-w-[160px]">
      <p className="text-slate-400 text-[10px] border-b border-[#222e3f] pb-1 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {Number(p.value) > 0 ? "+" : ""}{(Number(p.value) * 100).toFixed(2)}%
        </p>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OddsChart({
  snapshots,
  predictions,
  homeTeam,
  awayTeam
}: OddsChartProps) {
  const [view, setView] = useState<ChartView>("odds");
  const [market, setMarket] = useState<MarketFilter>("MONEYLINE");

  // Available markets from snapshot data
  const availableMarkets = useMemo(() => {
    const set = new Set(snapshots.map((s) => s.market));
    return (["MONEYLINE", "SPREAD", "TOTAL", "BTTS"] as MarketFilter[]).filter((m) =>
      set.has(m)
    );
  }, [snapshots]);

  useEffect(() => {
    if (availableMarkets.length > 0 && !availableMarkets.includes(market)) {
      setMarket(availableMarkets[0]);
    }
  }, [availableMarkets, market]);

  // Filter snapshots to selected market
  const marketSnapshots = useMemo(
    () => snapshots.filter((s) => s.market === market),
    [snapshots, market]
  );

  // All unique selections in this market
  const selections = useMemo(
    () => [...new Set(marketSnapshots.map((s) => s.selection))],
    [marketSnapshots]
  );

  // All unique bookmakers in this market
  const bookmakers = useMemo(
    () => [...new Set(marketSnapshots.map((s) => s.bookmaker.name))],
    [marketSnapshots]
  );

  // Build time-series: one row per capturedAt timestamp, columns per bookmaker+selection
  const timeSeriesData = useMemo(() => {
    if (marketSnapshots.length === 0) return [];

    // Group by timestamp
    const byTime = new Map<string, Record<string, number | string>>();

    for (const snap of marketSnapshots) {
      const sortTime = new Date(snap.capturedAt).getTime();
      const timeKey = Number.isFinite(sortTime) ? String(sortTime) : snap.capturedAt;
      if (!byTime.has(timeKey)) {
        byTime.set(timeKey, { _t: formatTime(snap.capturedAt), _sort: sortTime });
      }
      const row = byTime.get(timeKey)!;
      const key = `${snap.bookmaker.name}__${snap.selection}`;

      if (view === "odds") {
        row[key] = snap.priceDecimal;
      } else if (view === "implied") {
        row[key] = snap.impliedProb;
      } else {
        // EV: need model fair probability for this selection
        const pred = predictions.find(
          (p) => p.market === market && p.selection === snap.selection
        );
        if (pred) {
          row[key] = pred.fairProbability * snap.priceDecimal - 1;
        }
      }
    }

    return Array.from(byTime.values()).sort((a, b) => Number(a._sort) - Number(b._sort));
  }, [marketSnapshots, view, market, predictions]);

  // Build series keys: bookmaker__selection combos
  const seriesKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of timeSeriesData) {
      Object.keys(row).forEach((k) => { if (k !== "_t" && k !== "_sort") keys.add(k); });
    }
    return [...keys];
  }, [timeSeriesData]);

  // Model fair price lines (for odds and implied views)
  const fairLines = useMemo(() => {
    return predictions
      .filter((p) => p.market === market)
      .map((p) => ({
        selection: p.selection,
        fairPriceDecimal: p.fairPriceDecimal,
        fairProbability: p.fairProbability
      }));
  }, [predictions, market]);

  const isEmpty = timeSeriesData.length === 0;

  return (
    <div className="space-y-3">
      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Market tabs */}
        <div className="flex items-center gap-1 bg-[#080a0f] border border-[#222e3f] rounded p-0.5">
          {(availableMarkets.length > 0 ? availableMarkets : (["MONEYLINE"] as MarketFilter[])).map((m) => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={`px-2.5 py-1 text-[9px] font-mono font-bold tracking-wider rounded transition-colors ${
                market === m
                  ? "bg-[#151b26] text-sky-400 border border-[#222e3f]"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1.5">
          <ViewBtn active={view === "odds"} onClick={() => setView("odds")} icon={TrendingUp} label="Odds" />
          <ViewBtn active={view === "implied"} onClick={() => setView("implied")} icon={Percent} label="Implied" />
          <ViewBtn active={view === "ev"} onClick={() => setView("ev")} icon={BarChart2} label="EV" />
        </div>
      </div>

      {/* Chart */}
      {isEmpty ? (
        <div className="h-56 flex items-center justify-center text-slate-600 font-mono text-xs">
          No {market} odds data available for this match.
        </div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 0, height: 224 }}>
            {view === "ev" ? (
              <AreaChart data={timeSeriesData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <defs>
                  {seriesKeys.map((key, i) => (
                    <linearGradient key={key} id={`ev-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colorFor(i)} stopOpacity={0.12} />
                      <stop offset="95%" stopColor={colorFor(i)} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1d2836" />
                <XAxis dataKey="_t" {...AXIS_PROPS} />
                <YAxis
                  {...AXIS_PROPS}
                  tickFormatter={(v) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}%`}
                />
                <Tooltip content={<EvTooltip />} />
                <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="3 3" opacity={0.5} />
                <ReferenceLine y={0.05} stroke="#10b981" strokeDasharray="2 4" opacity={0.4}
                  label={{ value: "5% threshold", position: "insideTopRight", fill: "#10b981", fontSize: 9, fontFamily: "JetBrains Mono" }}
                />
                {seriesKeys.map((key, i) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={key.replace("__", " / ")}
                    stroke={colorFor(i)}
                    strokeWidth={1.5}
                    fill={`url(#ev-grad-${i})`}
                    dot={false}
                    connectNulls
                  />
                ))}
              </AreaChart>
            ) : (
              <LineChart data={timeSeriesData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1d2836" />
                <XAxis dataKey="_t" {...AXIS_PROPS} />
                <YAxis
                  {...AXIS_PROPS}
                  tickFormatter={
                    view === "implied"
                      ? (v) => `${(v * 100).toFixed(0)}%`
                      : (v) => v.toFixed(2)
                  }
                />
                <Tooltip content={view === "implied" ? <ProbTooltip /> : <OddsTooltip />} />
                <Legend
                  wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: "9px", color: "#64748b" }}
                  formatter={(value) => value.replace("__", " / ")}
                />
                {/* Model fair price reference lines */}
                {view === "odds" && fairLines.map((fl, i) => (
                  <ReferenceLine
                    key={fl.selection}
                    y={fl.fairPriceDecimal}
                    stroke="#475569"
                    strokeDasharray="4 3"
                    opacity={0.5}
                    label={{
                      value: `Fair: ${fl.selection}`,
                      position: "insideTopRight",
                      fill: "#475569",
                      fontSize: 8,
                      fontFamily: "JetBrains Mono"
                    }}
                  />
                ))}
                {view === "implied" && fairLines.map((fl) => (
                  <ReferenceLine
                    key={fl.selection}
                    y={fl.fairProbability}
                    stroke="#475569"
                    strokeDasharray="4 3"
                    opacity={0.5}
                    label={{
                      value: `Model: ${fl.selection}`,
                      position: "insideTopRight",
                      fill: "#475569",
                      fontSize: 8,
                      fontFamily: "JetBrains Mono"
                    }}
                  />
                ))}
                {seriesKeys.map((key, i) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={key.replace("__", " / ")}
                    stroke={colorFor(i)}
                    strokeWidth={1.5}
                    dot={{ r: 2, fill: colorFor(i), strokeWidth: 0 }}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend note */}
      <p className="text-[9px] font-mono text-slate-600">
        {view === "odds" && "Decimal odds over time. Dashed lines = model fair price."}
        {view === "implied" && "Raw implied probability (includes bookmaker margin). Dashed = model fair probability."}
        {view === "ev" && "EV = (model fair prob × decimal odds) − 1. Green threshold line at +5%."}
      </p>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "2-digit"
    });
  } catch {
    return iso;
  }
}
