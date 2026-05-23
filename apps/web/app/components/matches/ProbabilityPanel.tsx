"use client";

import React, { useMemo } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PredictionRow {
  id: string;
  market: string;
  selection: string;
  fairProbability: number;
  fairPriceDecimal: number;
  edgePct: number;
  rationale: string | null;
}

export interface SnapshotRow {
  market: string;
  selection: string;
  impliedProb: number;
  bookmakerMargin: number;
  bookmaker: { name: string };
}

interface ProbabilityPanelProps {
  predictions: PredictionRow[];
  snapshots: SnapshotRow[];
  homeTeam: string;
  awayTeam: string;
  homeXg?: number | null;
  awayXg?: number | null;
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: "#10141d",
  borderColor: "#222e3f",
  color: "#e2e8f0",
  fontFamily: "JetBrains Mono, monospace",
  fontSize: "11px",
  borderRadius: "4px"
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Single probability row: label + bar + value */
function ProbRow({
  label,
  modelProb,
  impliedProb,
  fairPrice,
  bestOdds,
  isHighlighted
}: {
  label: string;
  modelProb: number;
  impliedProb: number | null;
  fairPrice: number;
  bestOdds: number | null;
  isHighlighted: boolean;
}) {
  const edge = impliedProb != null ? (modelProb - impliedProb) * 100 : null;
  const hasEdge = edge != null && edge > 0;

  return (
    <div
      className={`rounded border px-3 py-2.5 space-y-2 transition-colors ${
        isHighlighted
          ? "border-sky-500/25 bg-sky-500/5"
          : "border-[#222e3f] bg-[#0c0f16]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-semibold text-slate-200 truncate">{label}</span>
        {edge != null && (
          <span
            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
              hasEdge
                ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                : edge < 0
                ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                : "text-slate-500 bg-slate-900 border-slate-800"
            }`}
          >
            {edge > 0 ? "+" : ""}{edge.toFixed(2)}pp
          </span>
        )}
      </div>

      {/* Model probability bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
          <span>MODEL</span>
          <span className="text-slate-300 font-semibold">{(modelProb * 100).toFixed(1)}%</span>
        </div>
        <div className="h-1.5 w-full bg-[#1d2836] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-sky-500 transition-all"
            style={{ width: `${Math.min(100, modelProb * 100)}%` }}
          />
        </div>
      </div>

      {/* Implied probability bar */}
      {impliedProb != null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
            <span>IMPLIED</span>
            <span className="text-slate-400">{(impliedProb * 100).toFixed(1)}%</span>
          </div>
          <div className="h-1.5 w-full bg-[#1d2836] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-slate-600 transition-all"
              style={{ width: `${Math.min(100, impliedProb * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Prices */}
      <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-0.5">
        <span>
          Fair: <span className="text-slate-300">{fairPrice.toFixed(3)}</span>
        </span>
        {bestOdds != null && (
          <span>
            Best: <span className={hasEdge ? "text-emerald-400 font-semibold" : "text-slate-300"}>
              {bestOdds.toFixed(3)}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

/** Market disagreement indicator */
function DisagreementMeter({
  modelProb,
  impliedProb,
  label
}: {
  modelProb: number;
  impliedProb: number;
  label: string;
}) {
  const delta = Math.abs(modelProb - impliedProb) * 100;
  const level = delta > 15 ? "high" : delta > 8 ? "medium" : "low";
  const colors = {
    low: { bar: "bg-emerald-500", text: "text-emerald-400", label: "LOW" },
    medium: { bar: "bg-amber-500", text: "text-amber-400", label: "MODERATE" },
    high: { bar: "bg-rose-500", text: "text-rose-400", label: "HIGH" }
  };
  const c = colors[level];

  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono text-slate-500 w-20 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-[#1d2836] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${c.bar} transition-all`}
          style={{ width: `${Math.min(100, delta * 3)}%` }}
        />
      </div>
      <span className={`text-[9px] font-mono font-bold w-16 text-right ${c.text}`}>
        {delta.toFixed(1)}pp {c.label}
      </span>
    </div>
  );
}

function poissonProbability(lambda: number, goals: number): number {
  let factorial = 1;
  for (let i = 2; i <= goals; i += 1) factorial *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, goals)) / factorial;
}

function buildPoissonSummary(homeXg: number, awayXg: number) {
  const maxGoals = 10;
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over25 = 0;
  let btts = 0;

  for (let homeGoals = 0; homeGoals <= maxGoals; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= maxGoals; awayGoals += 1) {
      const prob =
        poissonProbability(homeXg, homeGoals) * poissonProbability(awayXg, awayGoals);

      if (homeGoals > awayGoals) homeWin += prob;
      if (homeGoals === awayGoals) draw += prob;
      if (awayGoals > homeGoals) awayWin += prob;
      if (homeGoals + awayGoals > 2.5) over25 += prob;
      if (homeGoals > 0 && awayGoals > 0) btts += prob;
    }
  }

  return [
    { label: "Home win", value: homeWin, tone: "text-sky-400" },
    { label: "Draw", value: draw, tone: "text-slate-300" },
    { label: "Away win", value: awayWin, tone: "text-violet-400" },
    { label: "Over 2.5", value: over25, tone: "text-emerald-400" },
    { label: "BTTS", value: btts, tone: "text-amber-400" }
  ];
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProbabilityPanel({
  predictions,
  snapshots,
  homeTeam,
  awayTeam,
  homeXg,
  awayXg
}: ProbabilityPanelProps) {
  // Group predictions by market
  const byMarket = useMemo(() => {
    const map = new Map<string, PredictionRow[]>();
    for (const p of predictions) {
      if (!map.has(p.market)) map.set(p.market, []);
      map.get(p.market)!.push(p);
    }
    return map;
  }, [predictions]);

  // Best implied prob per selection (lowest implied = best odds)
  const bestImplied = useMemo(() => {
    const map = new Map<string, { impliedProb: number; bestOdds: number }>();
    for (const s of snapshots) {
      const key = `${s.market}__${s.selection}`;
      const existing = map.get(key);
      // Lower implied prob = better odds for bettor
      if (!existing || s.impliedProb < existing.impliedProb) {
        map.set(key, {
          impliedProb: s.impliedProb,
          bestOdds: 1 / s.impliedProb
        });
      }
    }
    return map;
  }, [snapshots]);

  // Moneyline predictions for radar chart
  const moneylinePreds = useMemo(
    () => byMarket.get("MONEYLINE") ?? [],
    [byMarket]
  );

  // Radar data: model vs implied for moneyline
  const radarData = useMemo(() => {
    return moneylinePreds.map((p) => {
      const key = `MONEYLINE__${p.selection}`;
      const implied = bestImplied.get(key);
      return {
        selection: p.selection === "HOME" ? homeTeam : p.selection === "AWAY" ? awayTeam : p.selection,
        model: parseFloat((p.fairProbability * 100).toFixed(1)),
        implied: implied ? parseFloat((implied.impliedProb * 100).toFixed(1)) : null
      };
    });
  }, [moneylinePreds, bestImplied, homeTeam, awayTeam]);

  // xG bar chart data
  const xgData = useMemo(() => {
    if (homeXg == null && awayXg == null) return [];
    return [
      { team: homeTeam.split(" ").pop() ?? homeTeam, xg: homeXg ?? 0, side: "home" },
      { team: awayTeam.split(" ").pop() ?? awayTeam, xg: awayXg ?? 0, side: "away" }
    ];
  }, [homeXg, awayXg, homeTeam, awayTeam]);

  // Rationale from first Poisson prediction
  const rationale = useMemo(() => {
    for (const [, preds] of byMarket) {
      for (const p of preds) {
        if (p.rationale) return p.rationale;
      }
    }
    return null;
  }, [byMarket]);

  // Parse xG from rationale string if not provided directly
  const parsedXg = useMemo(() => {
    if (homeXg != null && awayXg != null) return { home: homeXg, away: awayXg };
    if (!rationale) return null;
    const match = rationale.match(/home_xg=([\d.]+).*away_xg=([\d.]+)/);
    if (!match) return null;
    return { home: parseFloat(match[1]), away: parseFloat(match[2]) };
  }, [rationale, homeXg, awayXg]);

  const effectiveXgData = useMemo(() => {
    if (xgData.length > 0) return xgData;
    if (!parsedXg) return [];
    return [
      { team: homeTeam.split(" ").pop() ?? homeTeam, xg: parsedXg.home, side: "home" },
      { team: awayTeam.split(" ").pop() ?? awayTeam, xg: parsedXg.away, side: "away" }
    ];
  }, [xgData, parsedXg, homeTeam, awayTeam]);

  const poissonSummary = useMemo(() => {
    const home = effectiveXgData.find((d) => d.side === "home")?.xg;
    const away = effectiveXgData.find((d) => d.side === "away")?.xg;
    if (home == null || away == null) return [];
    return buildPoissonSummary(home, away);
  }, [effectiveXgData]);

  const hasData = predictions.length > 0;

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center font-mono">
        <p className="text-slate-500 text-sm">No model predictions available.</p>
        <p className="text-slate-600 text-xs mt-1">
          Run the Poisson prediction worker to generate probability estimates.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── 1x2 / Moneyline probabilities ── */}
      {moneylinePreds.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
            Moneyline Probabilities
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {moneylinePreds.map((p) => {
              const key = `MONEYLINE__${p.selection}`;
              const implied = bestImplied.get(key);
              const label =
                p.selection === "HOME"
                  ? homeTeam
                  : p.selection === "AWAY"
                  ? awayTeam
                  : p.selection;
              return (
                <ProbRow
                  key={p.id}
                  label={label}
                  modelProb={p.fairProbability}
                  impliedProb={implied?.impliedProb ?? null}
                  fairPrice={p.fairPriceDecimal}
                  bestOdds={implied?.bestOdds ?? null}
                  isHighlighted={p.edgePct > 0.05}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Radar: model vs implied ── */}
      {radarData.length > 0 && radarData.some((d) => d.implied != null) && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
            Model vs Market (Moneyline)
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 0, height: 192 }}>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="#1d2836" />
                <PolarAngleAxis
                  dataKey="selection"
                  tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
                />
                <Radar
                  name="Model"
                  dataKey="model"
                  stroke="#0ea5e9"
                  fill="#0ea5e9"
                  fillOpacity={0.12}
                  strokeWidth={1.5}
                />
                <Radar
                  name="Implied"
                  dataKey="implied"
                  stroke="#475569"
                  fill="#475569"
                  fillOpacity={0.08}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number) => [`${v.toFixed(1)}%`]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 text-[9px] font-mono text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-sky-500 inline-block" />
              Model probability
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-slate-500 inline-block opacity-60" />
              Market implied
            </span>
          </div>
        </div>
      )}

      {/* ── xG bar chart ── */}
      {effectiveXgData.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
            Expected Goals (xG)
          </h3>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 0, height: 112 }}>
              <BarChart
                data={effectiveXgData}
                layout="vertical"
                margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1d2836" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 3]}
                  stroke="#475569"
                  fontSize={10}
                  fontFamily="JetBrains Mono"
                  tickFormatter={(v) => v.toFixed(1)}
                />
                <YAxis
                  type="category"
                  dataKey="team"
                  stroke="#475569"
                  fontSize={10}
                  fontFamily="JetBrains Mono"
                  width={60}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number) => [v.toFixed(3), "xG"]}
                />
                <ReferenceLine x={1.3} stroke="#475569" strokeDasharray="3 3" opacity={0.4}
                  label={{ value: "avg", position: "top", fill: "#475569", fontSize: 8, fontFamily: "JetBrains Mono" }}
                />
                <Bar dataKey="xg" maxBarSize={20} radius={[0, 3, 3, 0]}>
                  {effectiveXgData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.side === "home" ? "#0ea5e9" : "#a78bfa"}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 text-[9px] font-mono text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 bg-sky-500/70 rounded-sm inline-block" />
              Home
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 bg-violet-500/70 rounded-sm inline-block" />
              Away
            </span>
          </div>
        </div>
      )}

      {/* Poisson probability summary */}
      {poissonSummary.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
            Poisson Probabilities
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {poissonSummary.map((item) => (
              <div key={item.label} className="rounded border border-[#222e3f] bg-[#0c0f16] px-3 py-2">
                <span className="block text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500">
                  {item.label}
                </span>
                <span className={`mt-1 block text-sm font-mono font-semibold ${item.tone}`}>
                  {(item.value * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
          <p className="text-[9px] font-mono text-slate-600">
            Derived from independent Poisson goal distributions using the displayed xG inputs.
          </p>
        </div>
      )}

      {/* ── Over/Under probabilities ── */}
      {byMarket.has("TOTAL") && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
            Totals (Over / Under)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {(byMarket.get("TOTAL") ?? []).map((p) => {
              const key = `TOTAL__${p.selection}`;
              const implied = bestImplied.get(key);
              return (
                <ProbRow
                  key={p.id}
                  label={p.selection}
                  modelProb={p.fairProbability}
                  impliedProb={implied?.impliedProb ?? null}
                  fairPrice={p.fairPriceDecimal}
                  bestOdds={implied?.bestOdds ?? null}
                  isHighlighted={p.edgePct > 0.05}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── BTTS ── */}
      {byMarket.has("BTTS") && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
            Both Teams to Score
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {(byMarket.get("BTTS") ?? []).map((p) => {
              const key = `BTTS__${p.selection}`;
              const implied = bestImplied.get(key);
              return (
                <ProbRow
                  key={p.id}
                  label={`BTTS ${p.selection}`}
                  modelProb={p.fairProbability}
                  impliedProb={implied?.impliedProb ?? null}
                  fairPrice={p.fairPriceDecimal}
                  bestOdds={implied?.bestOdds ?? null}
                  isHighlighted={p.edgePct > 0.05}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Market disagreement ── */}
      {snapshots.length > 0 && predictions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
            Market Disagreement Index
          </h3>
          <div className="space-y-2">
            {predictions
              .filter((p) => {
                const key = `${p.market}__${p.selection}`;
                return bestImplied.has(key);
              })
              .slice(0, 6)
              .map((p) => {
                const key = `${p.market}__${p.selection}`;
                const implied = bestImplied.get(key)!;
                const label =
                  p.selection === "HOME"
                    ? homeTeam
                    : p.selection === "AWAY"
                    ? awayTeam
                    : `${p.market} ${p.selection}`;
                return (
                  <DisagreementMeter
                    key={p.id}
                    label={label}
                    modelProb={p.fairProbability}
                    impliedProb={implied.impliedProb}
                  />
                );
              })}
          </div>
          <p className="text-[9px] font-mono text-slate-600">
            Disagreement = |model prob − implied prob|. High (&gt;15pp) indicates elevated model risk.
          </p>
        </div>
      )}

      {/* ── Model rationale ── */}
      {rationale && (
        <div className="bg-[#0c0f16] border border-[#222e3f] rounded p-3 space-y-1">
          <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500">
            Model Rationale
          </span>
          <p className="text-[11px] font-mono text-slate-400 leading-relaxed">{rationale}</p>
        </div>
      )}
    </div>
  );
}
