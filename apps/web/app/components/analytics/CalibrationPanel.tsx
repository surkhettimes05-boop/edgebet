"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScatterChart, Scatter,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, Legend
} from "recharts";
import { RefreshCw, Target, TrendingUp, BarChart2, Loader2, AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalibrationBin {
  binMidpoint: number;
  binLow: number;
  binHigh: number;
  predictedMean: number;
  actualWinRate: number | null;
  count: number;
  resolvedCount: number;
  brierScore: number | null;
}

interface DriftPoint {
  index: number;
  date: string;
  predictedProb: number;
  outcome: 1 | 0 | null;
  rollingPredictedMean: number | null;
  rollingActualRate: number | null;
  rollingBrier: number | null;
}

interface CalibrationStats {
  count: number;
  resolvedCount: number;
  meanBrierScore: number | null;
  meanPredictedProb: number | null;
  meanActualRate: number | null;
  reliability: number | null;
  resolution: number | null;
  calibrationError: number | null;
  byMarket: Record<string, { count: number; brierScore: number | null }>;
}

interface CalibrationData {
  stats: CalibrationStats;
  bins: CalibrationBin[];
  drift: DriftPoint[];
}

type ViewMode = "calibration" | "drift" | "brier";

// ─── Shared config ────────────────────────────────────────────────────────────

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

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  label, value, positive, subtitle
}: {
  label: string; value: string; positive?: boolean | null; subtitle?: string;
}) {
  const color = positive === true ? "text-emerald-400"
    : positive === false ? "text-rose-400"
    : "text-slate-300";
  return (
    <div className="flex flex-col gap-0.5 bg-[#0c0f16] border border-[#222e3f] rounded px-3 py-2 min-w-[90px]">
      <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500">{label}</span>
      <span className={`text-sm font-mono font-bold ${color}`}>{value}</span>
      {subtitle && <span className="text-[9px] font-mono text-slate-600">{subtitle}</span>}
    </div>
  );
}

// ─── View toggle ──────────────────────────────────────────────────────────────

function ViewBtn({
  active, onClick, icon: Icon, label
}: {
  active: boolean; onClick: () => void;
  icon: React.ComponentType<{ className?: string }>; label: string;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded border transition-colors ${
        active
          ? "bg-sky-500/10 border-sky-500/30 text-sky-400"
          : "border-[#222e3f] text-slate-500 hover:text-slate-300 hover:border-slate-600"
      }`}
    >
      <Icon className="h-3 w-3" />{label}
    </button>
  );
}

// ─── Custom tooltips ──────────────────────────────────────────────────────────

function CalibrationTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as CalibrationBin;
  if (!d) return null;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 space-y-1 border border-[#222e3f]">
      <p className="text-slate-400 text-[10px]">
        Bin: {(d.binLow * 100).toFixed(0)}–{(d.binHigh * 100).toFixed(0)}%
      </p>
      <p className="text-sky-400">Predicted: {(d.predictedMean * 100).toFixed(1)}%</p>
      {d.actualWinRate != null
        ? <p className={d.actualWinRate >= d.predictedMean ? "text-emerald-400" : "text-rose-400"}>
            Actual: {(d.actualWinRate * 100).toFixed(1)}%
          </p>
        : <p className="text-slate-600">Actual: no data</p>
      }
      <p className="text-slate-500 text-[10px]">N = {d.resolvedCount}</p>
    </div>
  );
}

function DriftTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 space-y-1 border border-[#222e3f]">
      <p className="text-slate-400 text-[10px]">#{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value != null ? (p.value * 100).toFixed(1) + "%" : "—"}
        </p>
      ))}
    </div>
  );
}

function BrierTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 space-y-1 border border-[#222e3f]">
      <p className="text-slate-400 text-[10px]">#{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value != null ? Number(p.value).toFixed(4) : "—"}
        </p>
      ))}
    </div>
  );
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_BINS: CalibrationBin[] = [
  { binMidpoint: 0.05, binLow: 0.0,  binHigh: 0.1,  predictedMean: 0.06, actualWinRate: 0.04, count: 8,  resolvedCount: 8,  brierScore: 0.058 },
  { binMidpoint: 0.15, binLow: 0.1,  binHigh: 0.2,  predictedMean: 0.15, actualWinRate: 0.13, count: 12, resolvedCount: 12, brierScore: 0.131 },
  { binMidpoint: 0.25, binLow: 0.2,  binHigh: 0.3,  predictedMean: 0.24, actualWinRate: 0.22, count: 15, resolvedCount: 15, brierScore: 0.189 },
  { binMidpoint: 0.35, binLow: 0.3,  binHigh: 0.4,  predictedMean: 0.35, actualWinRate: 0.31, count: 18, resolvedCount: 18, brierScore: 0.228 },
  { binMidpoint: 0.45, binLow: 0.4,  binHigh: 0.5,  predictedMean: 0.46, actualWinRate: 0.44, count: 22, resolvedCount: 22, brierScore: 0.248 },
  { binMidpoint: 0.55, binLow: 0.5,  binHigh: 0.6,  predictedMean: 0.55, actualWinRate: 0.57, count: 24, resolvedCount: 24, brierScore: 0.245 },
  { binMidpoint: 0.65, binLow: 0.6,  binHigh: 0.7,  predictedMean: 0.64, actualWinRate: 0.68, count: 20, resolvedCount: 20, brierScore: 0.213 },
  { binMidpoint: 0.75, binLow: 0.7,  binHigh: 0.8,  predictedMean: 0.75, actualWinRate: 0.78, count: 16, resolvedCount: 16, brierScore: 0.174 },
  { binMidpoint: 0.85, binLow: 0.8,  binHigh: 0.9,  predictedMean: 0.84, actualWinRate: 0.86, count: 10, resolvedCount: 10, brierScore: 0.122 },
  { binMidpoint: 0.95, binLow: 0.9,  binHigh: 1.0,  predictedMean: 0.94, actualWinRate: 0.92, count: 5,  resolvedCount: 5,  brierScore: 0.061 }
];

const DEMO_DRIFT: DriftPoint[] = Array.from({ length: 40 }, (_, i) => ({
  index: i + 1,
  date: `2026-0${Math.floor(i / 10) + 1}-${String((i % 10) + 1).padStart(2, "0")}`,
  predictedProb: 0.52 + Math.sin(i * 0.3) * 0.04,
  outcome: i % 3 === 0 ? 0 : 1,
  rollingPredictedMean: 0.52 + Math.sin(i * 0.2) * 0.02,
  rollingActualRate: 0.54 + Math.cos(i * 0.25) * 0.06,
  rollingBrier: 0.24 - i * 0.001
}));

const DEMO_STATS: CalibrationStats = {
  count: 150, resolvedCount: 150,
  meanBrierScore: 0.198,
  meanPredictedProb: 0.512,
  meanActualRate: 0.527,
  reliability: 0.0021,
  resolution: 0.0184,
  calibrationError: 0.015,
  byMarket: {
    MONEYLINE: { count: 80, brierScore: 0.201 },
    TOTAL:     { count: 45, brierScore: 0.193 },
    BTTS:      { count: 25, brierScore: 0.188 }
  }
};

// ─── Main component ───────────────────────────────────────────────────────────

interface CalibrationPanelProps {
  /** Fetch from /calibration endpoint when true (default) */
  standalone?: boolean;
  /** Pass data directly to skip internal fetch */
  data?: CalibrationData;
  className?: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function CalibrationPanel({
  standalone = true,
  data: externalData,
  className = ""
}: CalibrationPanelProps) {
  const [data, setData] = useState<CalibrationData | null>(externalData ?? null);
  const [isLoading, setIsLoading] = useState(standalone && !externalData);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [view, setView] = useState<ViewMode>("calibration");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/calibration`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load calibration data.");
      const d: CalibrationData = json.data;
      if (d.stats.resolvedCount === 0) {
        setData({ stats: DEMO_STATS, bins: DEMO_BINS, drift: DEMO_DRIFT });
        setIsDemo(true);
      } else {
        setData(d);
        setIsDemo(false);
      }
    } catch {
      setData({ stats: DEMO_STATS, bins: DEMO_BINS, drift: DEMO_DRIFT });
      setIsDemo(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (standalone && !externalData) fetchData();
  }, [standalone, externalData, fetchData]);

  // Calibration chart data: bins with data only
  const calibrationChartData = useMemo(() => {
    if (!data?.bins) return [];
    return data.bins
      .filter((b) => b.resolvedCount > 0)
      .map((b) => ({ ...b, perfect: b.binMidpoint }));
  }, [data]);

  // Drift chart data
  const driftData = useMemo(() => data?.drift ?? [], [data]);

  // Brier over time (rolling)
  const brierData = useMemo(() =>
    driftData.filter((d) => d.rollingBrier != null),
    [driftData]
  );

  const stats = data?.stats;

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-16 gap-2 text-slate-500 font-mono text-xs ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />Loading calibration data...
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/30 rounded px-4 py-3 text-xs text-rose-400 font-mono ${className}`}>
        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header: stats + controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <StatPill
            label="Brier Score"
            value={stats?.meanBrierScore != null ? stats.meanBrierScore.toFixed(4) : "—"}
            positive={stats?.meanBrierScore != null ? stats.meanBrierScore < 0.2 : null}
            subtitle="lower = better"
          />
          <StatPill
            label="Cal. Error"
            value={stats?.calibrationError != null ? `${(stats.calibrationError * 100).toFixed(2)}pp` : "—"}
            positive={stats?.calibrationError != null ? stats.calibrationError < 0.03 : null}
            subtitle="|pred − actual|"
          />
          <StatPill
            label="Reliability"
            value={stats?.reliability != null ? stats.reliability.toFixed(5) : "—"}
            positive={stats?.reliability != null ? stats.reliability < 0.005 : null}
            subtitle="lower = better"
          />
          <StatPill
            label="Resolution"
            value={stats?.resolution != null ? stats.resolution.toFixed(5) : "—"}
            positive={stats?.resolution != null ? stats.resolution > 0.01 : null}
            subtitle="higher = better"
          />
          <StatPill
            label="Sample"
            value={stats?.resolvedCount != null ? `${stats.resolvedCount}` : "—"}
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ViewBtn active={view === "calibration"} onClick={() => setView("calibration")} icon={Target} label="Calibration" />
          <ViewBtn active={view === "drift"} onClick={() => setView("drift")} icon={TrendingUp} label="Drift" />
          <ViewBtn active={view === "brier"} onClick={() => setView("brier")} icon={BarChart2} label="Brier" />
          {standalone && (
            <button onClick={fetchData} aria-label="Refresh"
              className="p-1.5 text-slate-500 hover:text-slate-200 border border-[#222e3f] rounded hover:border-slate-600 transition-colors">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {isDemo && (
        <p className="text-[10px] font-mono text-amber-500/70">
          Showing demo data — no resolved predictions in database yet.
        </p>
      )}

      {/* ── CALIBRATION VIEW ── */}
      {view === "calibration" && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-slate-600">
            Predicted probability vs actual win rate per bin. Dots on the diagonal = perfect calibration.
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1d2836" />
                <XAxis
                  type="number" dataKey="predictedMean" name="Predicted"
                  domain={[0, 1]} {...AXIS_PROPS}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  label={{ value: "Predicted prob", position: "insideBottom", offset: -2, fill: "#475569", fontSize: 9, fontFamily: "JetBrains Mono" }}
                />
                <YAxis
                  type="number" dataKey="actualWinRate" name="Actual"
                  domain={[0, 1]} {...AXIS_PROPS}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                />
                <Tooltip content={<CalibrationTooltip />} />
                {/* Perfect calibration diagonal */}
                <ReferenceLine
                  segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
                  stroke="#475569" strokeDasharray="4 3" opacity={0.5}
                  label={{ value: "Perfect", position: "insideTopLeft", fill: "#475569", fontSize: 8, fontFamily: "JetBrains Mono" }}
                />
                <Scatter
                  data={calibrationChartData}
                  fill="#0ea5e9"
                  shape={(props: any) => {
                    const { cx, cy, payload } = props;
                    const r = Math.max(4, Math.min(12, payload.resolvedCount / 4));
                    const isAbove = payload.actualWinRate >= payload.predictedMean;
                    return <circle cx={cx} cy={cy} r={r} fill={isAbove ? "#10b981" : "#f43f5e"} fillOpacity={0.75} stroke="none" />;
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 text-[9px] font-mono text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70 inline-block" />Actual ≥ predicted</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500/70 inline-block" />Actual &lt; predicted</span>
            <span className="text-slate-600">Dot size = sample count</span>
          </div>
        </div>
      )}

      {/* ── DRIFT VIEW ── */}
      {view === "drift" && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-slate-600">
            Rolling mean predicted probability vs rolling actual win rate. Divergence indicates model drift.
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={driftData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1d2836" />
                <XAxis dataKey="index" {...AXIS_PROPS} tickFormatter={(v) => `#${v}`} />
                <YAxis {...AXIS_PROPS} domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <Tooltip content={<DriftTooltip />} />
                <Legend wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: "9px", color: "#64748b" }} />
                <ReferenceLine y={0.5} stroke="#475569" strokeDasharray="3 3" opacity={0.3} />
                <Line type="monotone" dataKey="rollingPredictedMean" name="Rolling predicted" stroke="#0ea5e9" strokeWidth={1.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="rollingActualRate" name="Rolling actual" stroke="#10b981" strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── BRIER VIEW ── */}
      {view === "brier" && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-slate-600">
            Rolling Brier score over time. Downward trend = improving calibration. 0.25 = random baseline.
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={brierData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1d2836" />
                <XAxis dataKey="index" {...AXIS_PROPS} tickFormatter={(v) => `#${v}`} />
                <YAxis {...AXIS_PROPS} domain={[0, 0.35]} tickFormatter={(v) => v.toFixed(2)} />
                <Tooltip content={<BrierTooltip />} />
                <ReferenceLine y={0.25} stroke="#f59e0b" strokeDasharray="3 3" opacity={0.5}
                  label={{ value: "Random (0.25)", position: "insideTopRight", fill: "#f59e0b", fontSize: 8, fontFamily: "JetBrains Mono" }} />
                <Line type="monotone" dataKey="rollingBrier" name="Rolling Brier" stroke="#a78bfa" strokeWidth={1.5} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Per-market breakdown */}
      {stats?.byMarket && Object.keys(stats.byMarket).length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500">By Market</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {Object.entries(stats.byMarket).map(([market, m]) => (
              <div key={market} className="bg-[#0c0f16] border border-[#222e3f] rounded px-3 py-2">
                <p className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">{market}</p>
                <p className="text-xs font-mono text-slate-300 mt-0.5">
                  Brier: <span className={m.brierScore != null && m.brierScore < 0.2 ? "text-emerald-400" : "text-amber-400"}>
                    {m.brierScore != null ? m.brierScore.toFixed(4) : "—"}
                  </span>
                </p>
                <p className="text-[9px] font-mono text-slate-600">N = {m.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formula note */}
      <p className="text-[9px] font-mono text-slate-600 border-t border-[#222e3f]/40 pt-3">
        Brier = (1/N)Σ(p̂ − o)². Reliability = Σ(nₖ/N)(p̄ₖ − ōₖ)². Resolution = Σ(nₖ/N)(ōₖ − ō)².
        Brier = Reliability − Resolution + Uncertainty.
      </p>
    </div>
  );
}
