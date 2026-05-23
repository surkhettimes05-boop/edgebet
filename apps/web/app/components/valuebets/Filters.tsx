"use client";

import React from "react";
import { SlidersHorizontal, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SortKey =
  | "ev_desc"
  | "ev_asc"
  | "edge_desc"
  | "model_prob_desc"
  | "market_agreement";

export interface FilterState {
  league: string;
  market: string;
  bookmaker: string;
  evThreshold: string;   // stored as string for input binding, parsed on use
  decision: "ALL" | "SIGNAL" | "NO_BET";
  sort: SortKey;
}

export const FILTER_DEFAULTS: FilterState = {
  league: "",
  market: "",
  bookmaker: "",
  evThreshold: "",
  decision: "ALL",
  sort: "ev_desc"
};

interface FiltersProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  leagues: string[];
  bookmakers: string[];
  activeCount: number;
  totalCount: number;
}

// ─── Option lists ─────────────────────────────────────────────────────────────

const MARKETS = ["MONEYLINE", "SPREAD", "TOTAL", "PLAYER_PROP", "BTTS"];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "ev_desc",          label: "Highest EV" },
  { value: "ev_asc",           label: "Lowest EV" },
  { value: "edge_desc",        label: "Largest Edge" },
  { value: "model_prob_desc",  label: "Highest Model Confidence" },
  { value: "market_agreement", label: "Strongest Market Agreement" }
];

const DECISION_OPTIONS = [
  { value: "ALL",    label: "All" },
  { value: "SIGNAL", label: "Signal only" },
  { value: "NO_BET", label: "No-Bet only" }
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasActiveFilters(f: FilterState): boolean {
  return (
    f.league !== "" ||
    f.market !== "" ||
    f.bookmaker !== "" ||
    f.evThreshold !== "" ||
    f.decision !== "ALL"
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Filters({
  filters,
  onChange,
  leagues,
  bookmakers,
  activeCount,
  totalCount
}: FiltersProps) {
  function set<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  function reset() {
    onChange({ ...FILTER_DEFAULTS, sort: filters.sort });
  }

  const active = hasActiveFilters(filters);

  return (
    <div className="bg-[#0c0f16] border border-[#222e3f] rounded-lg p-3 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {active && (
            <span className="bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded px-1.5 py-0.5 text-[9px]">
              ACTIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-slate-500">
            <span className="text-slate-300 font-semibold">{activeCount}</span>
            {" / "}
            {totalCount} signals
          </span>
          {active && (
            <button
              onClick={reset}
              className="flex items-center gap-1 text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter controls — responsive grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {/* League */}
        <div className="space-y-1">
          <label className="filter-label">League</label>
          <select
            value={filters.league}
            onChange={(e) => set("league", e.target.value)}
            className="filter-select"
          >
            <option value="">All leagues</option>
            {leagues.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        {/* Market */}
        <div className="space-y-1">
          <label className="filter-label">Market</label>
          <select
            value={filters.market}
            onChange={(e) => set("market", e.target.value)}
            className="filter-select"
          >
            <option value="">All markets</option>
            {MARKETS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Bookmaker */}
        <div className="space-y-1">
          <label className="filter-label">Bookmaker</label>
          <select
            value={filters.bookmaker}
            onChange={(e) => set("bookmaker", e.target.value)}
            className="filter-select"
          >
            <option value="">All bookmakers</option>
            {bookmakers.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* EV threshold */}
        <div className="space-y-1">
          <label className="filter-label">Min EV%</label>
          <input
            type="number"
            step="0.5"
            min="-20"
            max="50"
            value={filters.evThreshold}
            onChange={(e) => set("evThreshold", e.target.value)}
            placeholder="e.g. 5"
            className="filter-select"
          />
        </div>

        {/* Decision */}
        <div className="space-y-1">
          <label className="filter-label">Decision</label>
          <select
            value={filters.decision}
            onChange={(e) => set("decision", e.target.value as FilterState["decision"])}
            className="filter-select"
          >
            {DECISION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div className="space-y-1">
          <label className="filter-label">Sort by</label>
          <select
            value={filters.sort}
            onChange={(e) => set("sort", e.target.value as SortKey)}
            className="filter-select"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Shared field styles */}
      <style>{`
        .filter-label {
          display: block;
          font-size: 9px;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #64748b;
        }
        .filter-select {
          width: 100%;
          background: #080a0f;
          border: 1px solid #222e3f;
          border-radius: 4px;
          padding: 5px 8px;
          font-size: 11px;
          font-family: 'JetBrains Mono', monospace;
          color: #cbd5e1;
          outline: none;
          transition: border-color 0.15s;
          appearance: none;
          -webkit-appearance: none;
        }
        .filter-select::placeholder { color: #475569; }
        .filter-select:focus { border-color: #0ea5e9; }
        .filter-select option { background: #10141d; }
      `}</style>
    </div>
  );
}
