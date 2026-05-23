"use client";

import React, { useState } from "react";
import { ArrowUpDown, Pencil, CheckCircle, Trash2, ChevronUp, ChevronDown } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrackedBetRow {
  id: string;
  createdAt: string;
  placedAt: string | null;
  match: {
    homeTeam: { name: string };
    awayTeam: { name: string };
    league: { name: string };
  } | null;
  market: string;
  selection: string;
  stakeUnits: number;
  priceDecimal: number;
  evAtEntry: number | null;
  clvPct: number | null;
  closingPriceDecimal: number | null;
  status: string;
  pnl: number | null;
  bookmaker: { name: string } | null;
}

interface BetTableProps {
  bets: TrackedBetRow[];
  onEdit: (bet: TrackedBetRow) => void;
  onSettle: (bet: TrackedBetRow) => void;
  onVoid: (bet: TrackedBetRow) => void;
}

type SortKey = "date" | "match" | "market" | "stake" | "odds" | "ev" | "clv" | "pnl" | "status";
type SortDir = "asc" | "desc";

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    WON: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    LOST: "bg-rose-500/10 border-rose-500/20 text-rose-400",
    PUSH: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    PLACED: "bg-sky-500/10 border-sky-500/20 text-sky-400",
    TRACKED: "bg-slate-800 border-slate-700 text-slate-400",
    VOID: "bg-slate-900 border-slate-800 text-slate-600"
  };
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider ${
        map[status] ?? "bg-slate-900 border-slate-800 text-slate-400"
      }`}
    >
      {status}
    </span>
  );
}

// ─── Sortable header cell ─────────────────────────────────────────────────────

function SortTh({
  label,
  sortKey,
  current,
  dir,
  onSort,
  className = ""
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = current === sortKey;
  return (
    <th
      className={`px-3 py-2.5 font-semibold cursor-pointer select-none whitespace-nowrap ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (
          dir === "asc" ? (
            <ChevronUp className="h-3 w-3 text-sky-400" />
          ) : (
            <ChevronDown className="h-3 w-3 text-sky-400" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BetTable({ bets, onEdit, onSettle, onVoid }: BetTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...bets].sort((a, b) => {
    let av: number | string = 0;
    let bv: number | string = 0;

    switch (sortKey) {
      case "date":
        av = a.placedAt ?? a.createdAt;
        bv = b.placedAt ?? b.createdAt;
        break;
      case "match":
        av = matchLabel(a.match);
        bv = matchLabel(b.match);
        break;
      case "market":
        av = a.market;
        bv = b.market;
        break;
      case "stake":
        av = a.stakeUnits;
        bv = b.stakeUnits;
        break;
      case "odds":
        av = a.priceDecimal;
        bv = b.priceDecimal;
        break;
      case "ev":
        av = a.evAtEntry ?? -Infinity;
        bv = b.evAtEntry ?? -Infinity;
        break;
      case "clv":
        av = a.clvPct ?? -Infinity;
        bv = b.clvPct ?? -Infinity;
        break;
      case "pnl":
        av = a.pnl ?? -Infinity;
        bv = b.pnl ?? -Infinity;
        break;
      case "status":
        av = a.status;
        bv = b.status;
        break;
    }

    if (typeof av === "string" && typeof bv === "string") {
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortDir === "asc"
      ? (av as number) - (bv as number)
      : (bv as number) - (av as number);
  });

  if (bets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center font-mono">
        <p className="text-slate-500 text-sm">No bets logged yet.</p>
        <p className="text-slate-600 text-xs mt-1">Use the LOG BET button to record your first entry.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full min-w-[960px] border-collapse text-xs text-left font-mono">
        <thead className="bg-[#151b26] border-b border-[#222e3f] text-slate-400">
          <tr>
            <SortTh label="DATE" sortKey="date" current={sortKey} dir={sortDir} onSort={handleSort} className="px-3 py-2.5" />
            <SortTh label="MATCH" sortKey="match" current={sortKey} dir={sortDir} onSort={handleSort} />
            <SortTh label="MARKET" sortKey="market" current={sortKey} dir={sortDir} onSort={handleSort} />
            <th className="px-3 py-2.5 font-semibold">SELECTION</th>
            <SortTh label="STAKE" sortKey="stake" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
            <SortTh label="ODDS" sortKey="odds" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
            <SortTh label="EV%" sortKey="ev" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
            <SortTh label="CLV%" sortKey="clv" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
            <SortTh label="STATUS" sortKey="status" current={sortKey} dir={sortDir} onSort={handleSort} className="text-center" />
            <SortTh label="NET P&L" sortKey="pnl" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
            <th className="px-3 py-2.5 font-semibold text-center">ACTIONS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#222e3f]/40 text-slate-300">
          {sorted.map((bet) => {
            const isSettled = ["WON", "LOST", "PUSH", "VOID"].includes(bet.status);
            const isVoid = bet.status === "VOID";
            const dateStr = formatDate(bet.placedAt ?? bet.createdAt);

            return (
              <tr
                key={bet.id}
                className={`hover:bg-[#151b26]/50 transition-colors ${isVoid ? "opacity-40" : ""}`}
              >
                {/* Date */}
                <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{dateStr}</td>

                {/* Match */}
                <td className="px-3 py-3 font-semibold text-slate-200 whitespace-nowrap">
                  {matchLabel(bet.match)}
                  {bet.match?.league?.name && (
                    <span className="block text-[10px] text-slate-500 font-normal">
                      {bet.match.league.name}
                    </span>
                  )}
                </td>

                {/* Market */}
                <td className="px-3 py-3 text-slate-400">{bet.market}</td>

                {/* Selection */}
                <td className="px-3 py-3 text-slate-200 max-w-[140px] truncate" title={bet.selection}>
                  {bet.selection}
                  {bet.bookmaker && (
                    <span className="block text-[10px] text-slate-600">{bet.bookmaker.name}</span>
                  )}
                </td>

                {/* Stake */}
                <td className="px-3 py-3 text-right">{bet.stakeUnits.toFixed(2)}u</td>

                {/* Odds */}
                <td className="px-3 py-3 text-right font-semibold">{bet.priceDecimal.toFixed(2)}</td>

                {/* EV at entry */}
                <td className={`px-3 py-3 text-right font-semibold ${evColor(bet.evAtEntry)}`}>
                  {bet.evAtEntry != null
                    ? `${bet.evAtEntry > 0 ? "+" : ""}${(bet.evAtEntry * 100).toFixed(2)}%`
                    : <span className="text-slate-600">—</span>}
                </td>

                {/* CLV */}
                <td className={`px-3 py-3 text-right font-semibold ${clvColor(bet.clvPct)}`}>
                  {bet.clvPct != null
                    ? `${bet.clvPct > 0 ? "+" : ""}${(bet.clvPct * 100).toFixed(2)}%`
                    : <span className="text-slate-600">—</span>}
                </td>

                {/* Status */}
                <td className="px-3 py-3 text-center">
                  <StatusBadge status={bet.status} />
                </td>

                {/* P&L */}
                <td className={`px-3 py-3 text-right font-semibold ${pnlColor(bet.pnl)}`}>
                  {bet.pnl != null
                    ? `${bet.pnl > 0 ? "+" : ""}${bet.pnl.toFixed(2)}u`
                    : <span className="text-slate-600">—</span>}
                </td>

                {/* Actions */}
                <td className="px-3 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {!isSettled && (
                      <>
                        <button
                          onClick={() => onEdit(bet)}
                          aria-label="Edit bet"
                          title="Edit"
                          className="text-slate-500 hover:text-sky-400 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onSettle(bet)}
                          aria-label="Settle bet"
                          title="Settle"
                          className="text-slate-500 hover:text-emerald-400 transition-colors"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    {!isVoid && (
                      <button
                        onClick={() => onVoid(bet)}
                        aria-label="Void bet"
                        title="Void"
                        className="text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function matchLabel(match: TrackedBetRow["match"]): string {
  if (!match) return "—";
  return `${match.homeTeam.name} vs ${match.awayTeam.name}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit"
    });
  } catch {
    return iso;
  }
}

function evColor(ev: number | null): string {
  if (ev == null) return "";
  return ev > 0 ? "text-emerald-400" : ev < 0 ? "text-rose-400" : "text-slate-400";
}

function clvColor(clv: number | null): string {
  if (clv == null) return "";
  return clv > 0 ? "text-emerald-400" : clv < 0 ? "text-rose-400" : "text-slate-400";
}

function pnlColor(pnl: number | null): string {
  if (pnl == null) return "";
  return pnl > 0 ? "text-emerald-400" : pnl < 0 ? "text-rose-400" : "text-slate-400";
}
