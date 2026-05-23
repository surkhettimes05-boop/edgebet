"use client";

import React from "react";
import { ChevronUp, ChevronDown, ArrowUpDown, Info } from "lucide-react";
import type { SortKey } from "./Filters";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValueBetSignal {
  id: string;
  match: string;
  league: string;
  market: string;
  selection: string;
  bookmaker: string;
  modelProb: number;       // 0–1
  impliedProb: number;     // 0–1, raw (with vig)
  edgePct: number;         // modelProb - impliedProb, as percentage points
  fairPrice: number;       // 1 / modelProb
  bestOdds: number;        // decimal
  ev: number;              // modelProb * bestOdds - 1
  decision: "SIGNAL" | "NO_BET";
  riskFlags: RiskFlag[];
}

export type RiskFlagType =
  | "EV_NOT_ABOVE_THRESHOLD"
  | "DATA_QUALITY_UNACCEPTABLE"
  | "MARKET_DISAGREEMENT_EXTREME"
  | "LINEUP_UNCERTAINTY_UNACCEPTABLE"
  | "MISSING_ODDS";

export interface RiskFlag {
  type: RiskFlagType;
  label: string;
  severity: "low" | "medium" | "high";
}

// ─── Risk flag config ─────────────────────────────────────────────────────────

export const RISK_FLAG_CONFIG: Record<RiskFlagType, { label: string; severity: "low" | "medium" | "high"; description: string }> = {
  EV_NOT_ABOVE_THRESHOLD: {
    label: "EV < threshold",
    severity: "low",
    description: "Expected value does not clear the minimum 5% threshold required for a signal."
  },
  DATA_QUALITY_UNACCEPTABLE: {
    label: "Data quality",
    severity: "high",
    description: "Underlying data quality is insufficient to support a reliable probability estimate."
  },
  MARKET_DISAGREEMENT_EXTREME: {
    label: "Market disagreement",
    severity: "medium",
    description: "Model probability diverges significantly from market consensus. Elevated model risk."
  },
  LINEUP_UNCERTAINTY_UNACCEPTABLE: {
    label: "Lineup uncertainty",
    severity: "medium",
    description: "Significant lineup uncertainty detected. Probability estimate may be unreliable."
  },
  MISSING_ODDS: {
    label: "No odds",
    severity: "high",
    description: "No bookmaker odds available for this selection."
  }
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function RiskFlagChip({ flag }: { flag: RiskFlag }) {
  const config = RISK_FLAG_CONFIG[flag.type];
  const colors = {
    low: "bg-slate-800 border-slate-700 text-slate-400",
    medium: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    high: "bg-rose-500/10 border-rose-500/20 text-rose-400"
  };
  return (
    <span
      title={config.description}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-mono font-bold tracking-wider cursor-help ${colors[flag.severity]}`}
    >
      {config.label}
    </span>
  );
}

function DecisionBadge({ decision }: { decision: "SIGNAL" | "NO_BET" }) {
  if (decision === "SIGNAL") {
    return (
      <span className="inline-block rounded border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider text-sky-400">
        SIGNAL
      </span>
    );
  }
  return (
    <span className="inline-block rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider text-slate-500">
      NO BET
    </span>
  );
}

/** Horizontal probability bar showing model prob vs implied prob */
function ProbBar({ modelProb, impliedProb }: { modelProb: number; impliedProb: number }) {
  const modelPct = Math.min(100, Math.max(0, modelProb * 100));
  const impliedPct = Math.min(100, Math.max(0, impliedProb * 100));
  const hasEdge = modelProb > impliedProb;

  return (
    <div className="flex flex-col gap-0.5 min-w-[80px]">
      {/* Model prob bar */}
      <div className="relative h-1.5 w-full bg-[#1d2836] rounded-full overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all ${hasEdge ? "bg-sky-500" : "bg-slate-600"}`}
          style={{ width: `${modelPct}%` }}
        />
      </div>
      {/* Implied prob bar */}
      <div className="relative h-1.5 w-full bg-[#1d2836] rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-slate-600"
          style={{ width: `${impliedPct}%` }}
        />
      </div>
      <div className="flex justify-between text-[8px] font-mono text-slate-600 mt-0.5">
        <span>MODEL</span>
        <span>IMPLIED</span>
      </div>
    </div>
  );
}

/** EV percentage display with subtle background fill */
function EvCell({ ev }: { ev: number }) {
  const pct = (ev * 100).toFixed(2);
  const isPositive = ev > 0;
  return (
    <span
      className={`inline-block font-mono font-bold text-xs px-2 py-0.5 rounded ${
        isPositive
          ? "text-emerald-400 bg-emerald-500/8"
          : ev < 0
          ? "text-rose-400 bg-rose-500/8"
          : "text-slate-400"
      }`}
    >
      {isPositive ? "+" : ""}{pct}%
    </span>
  );
}

// ─── Sort header ──────────────────────────────────────────────────────────────

// ValueBetTable doesn't own sort state — sort is managed by Filters.
// We show a static indicator on the active sort column.
function ColHeader({
  label,
  align = "left",
  tooltip
}: {
  label: string;
  align?: "left" | "right" | "center";
  tooltip?: string;
}) {
  return (
    <th
      className={`px-3 py-2.5 font-semibold whitespace-nowrap text-${align}`}
      title={tooltip}
    >
      <span className="flex items-center gap-1 justify-inherit">
        {label}
        {tooltip && <Info className="h-2.5 w-2.5 opacity-40 shrink-0" />}
      </span>
    </th>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ValueBetTableProps {
  signals: ValueBetSignal[];
  selectedId: string | null;
  onSelect: (signal: ValueBetSignal) => void;
}

export default function ValueBetTable({ signals, selectedId, onSelect }: ValueBetTableProps) {
  if (signals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center font-mono">
        <p className="text-slate-500 text-sm">No signals match the current filters.</p>
        <p className="text-slate-600 text-xs mt-1">
          Adjust the EV threshold or clear active filters to see more results.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full min-w-[900px] border-collapse text-xs text-left font-mono">
        <thead className="bg-[#151b26] border-b border-[#222e3f] text-slate-400 text-[10px]">
          <tr>
            <ColHeader label="MATCH" />
            <ColHeader label="MARKET" />
            <ColHeader label="SELECTION" />
            <ColHeader label="BOOKMAKER" />
            <ColHeader
              label="PROB COMPARISON"
              tooltip="Top bar: model probability. Bottom bar: bookmaker implied probability."
            />
            <ColHeader label="MODEL" align="right" tooltip="Model fair probability estimate" />
            <ColHeader label="IMPLIED" align="right" tooltip="Bookmaker implied probability (raw, with vig)" />
            <ColHeader label="EDGE" align="right" tooltip="Model prob − implied prob (percentage points)" />
            <ColHeader label="FAIR PRICE" align="right" tooltip="1 / model probability" />
            <ColHeader label="BEST ODDS" align="right" tooltip="Best available decimal odds" />
            <ColHeader label="EV%" align="right" tooltip="Expected value: (model prob × best odds) − 1" />
            <ColHeader label="RISK FLAGS" align="center" />
            <ColHeader label="DECISION" align="center" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[#222e3f]/30">
          {signals.map((sig) => {
            const isSelected = sig.id === selectedId;
            const isSignal = sig.decision === "SIGNAL";

            return (
              <tr
                key={sig.id}
                onClick={() => onSelect(sig)}
                className={`cursor-pointer transition-colors group ${
                  isSelected
                    ? "bg-[#151b26] border-l-2 border-l-sky-500"
                    : isSignal
                    ? "hover:bg-[#10141d]/80"
                    : "opacity-60 hover:opacity-80 hover:bg-[#10141d]/40"
                }`}
              >
                {/* Match */}
                <td className="px-3 py-3">
                  <div className="font-semibold text-slate-200 leading-tight">{sig.match}</div>
                  {sig.league && (
                    <div className="text-[9px] text-slate-600 mt-0.5 uppercase tracking-wider">
                      {sig.league}
                    </div>
                  )}
                </td>

                {/* Market */}
                <td className="px-3 py-3 text-slate-400">{sig.market}</td>

                {/* Selection */}
                <td className="px-3 py-3 text-slate-200 max-w-[140px]">
                  <span className="truncate block" title={sig.selection}>
                    {sig.selection}
                  </span>
                </td>

                {/* Bookmaker */}
                <td className="px-3 py-3 text-slate-500">
                  {sig.bookmaker || <span className="text-slate-700">—</span>}
                </td>

                {/* Probability bars */}
                <td className="px-3 py-3">
                  <ProbBar modelProb={sig.modelProb} impliedProb={sig.impliedProb} />
                </td>

                {/* Model prob */}
                <td className="px-3 py-3 text-right text-slate-300">
                  {(sig.modelProb * 100).toFixed(1)}%
                </td>

                {/* Implied prob */}
                <td className="px-3 py-3 text-right text-slate-400">
                  {(sig.impliedProb * 100).toFixed(1)}%
                </td>

                {/* Edge */}
                <td
                  className={`px-3 py-3 text-right font-semibold ${
                    sig.edgePct > 0
                      ? "text-emerald-400"
                      : sig.edgePct < 0
                      ? "text-rose-400"
                      : "text-slate-400"
                  }`}
                >
                  {sig.edgePct > 0 ? "+" : ""}
                  {sig.edgePct.toFixed(2)}pp
                </td>

                {/* Fair price */}
                <td className="px-3 py-3 text-right text-slate-500">
                  {sig.fairPrice.toFixed(3)}
                </td>

                {/* Best odds */}
                <td className="px-3 py-3 text-right font-semibold text-slate-200">
                  {sig.bestOdds.toFixed(3)}
                </td>

                {/* EV% */}
                <td className="px-3 py-3 text-right">
                  <EvCell ev={sig.ev} />
                </td>

                {/* Risk flags */}
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1 justify-center">
                    {sig.riskFlags.length === 0 ? (
                      <span className="text-[9px] text-slate-700 font-mono">—</span>
                    ) : (
                      sig.riskFlags.map((f) => (
                        <RiskFlagChip key={f.type} flag={f} />
                      ))
                    )}
                  </div>
                </td>

                {/* Decision */}
                <td className="px-3 py-3 text-center">
                  <DecisionBadge decision={sig.decision} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
