"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  Percent,
  Shield,
  RefreshCw,
  Loader2,
  AlertCircle,
  FlaskConical
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine
} from "recharts";

import StatCard from "../components/StatCard";
import Panel from "../components/Panel";
import VarianceNotice from "../components/VarianceNotice";
import Filters, { FilterState, FILTER_DEFAULTS, SortKey } from "../components/valuebets/Filters";
import ValueBetTable, {
  ValueBetSignal,
  RiskFlagType,
  RISK_FLAG_CONFIG
} from "../components/valuebets/ValueBetTable";

// ─── Constants ────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const EV_THRESHOLD = 0.05; // 5% — mirrors noBetEngine.js

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiPrediction {
  id: string;
  market: string;
  selection: string;
  fairProbability: string | number;
  fairPriceDecimal: string | number;
  edgePct: string | number;
  rationale: string | null;
  match: {
    homeTeam: { name: string };
    awayTeam: { name: string };
    league: { name: string; sport: string };
    oddsSnapshots?: Array<{
      priceDecimal: string | number;
      bookmaker: { name: string };
      capturedAt: string;
    }>;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert an API prediction record into a ValueBetSignal */
function toSignal(p: ApiPrediction): ValueBetSignal {
  const modelProb = Number(p.fairProbability);
  const fairPrice = Number(p.fairPriceDecimal);
  const edgePct = Number(p.edgePct);

  // Best odds: use the highest decimal odds from snapshots, or derive from fair price + edge
  const snapshots = p.match?.oddsSnapshots ?? [];
  const bestOdds =
    snapshots.length > 0
      ? Math.max(...snapshots.map((s) => Number(s.priceDecimal)))
      : fairPrice * (1 + edgePct / 100);

  const impliedProb = bestOdds > 1 ? 1 / bestOdds : 0;
  const ev = modelProb * bestOdds - 1;

  // Bookmaker: use the one with the best odds
  const bestSnapshot =
    snapshots.length > 0
      ? snapshots.reduce((best, s) =>
          Number(s.priceDecimal) > Number(best.priceDecimal) ? s : best
        )
      : null;
  const bookmaker = bestSnapshot?.bookmaker?.name ?? "";

  // Risk flags
  const riskFlags = buildRiskFlags({ ev, edgePct, modelProb, impliedProb, hasOdds: bestOdds > 1 });

  const decision: "SIGNAL" | "NO_BET" = riskFlags.length === 0 ? "SIGNAL" : "NO_BET";

  return {
    id: p.id,
    match: p.match
      ? `${p.match.homeTeam.name} vs ${p.match.awayTeam.name}`
      : "Unknown Match",
    league: p.match?.league?.name ?? "",
    market: p.market,
    selection: p.selection,
    bookmaker,
    modelProb,
    impliedProb,
    edgePct: modelProb * 100 - impliedProb * 100,
    fairPrice,
    bestOdds,
    ev,
    decision,
    riskFlags
  };
}

function buildRiskFlags({
  ev,
  edgePct,
  modelProb,
  impliedProb,
  hasOdds
}: {
  ev: number;
  edgePct: number;
  modelProb: number;
  impliedProb: number;
  hasOdds: boolean;
}) {
  const flags: ValueBetSignal["riskFlags"] = [];

  if (!hasOdds) {
    flags.push({ type: "MISSING_ODDS", ...RISK_FLAG_CONFIG["MISSING_ODDS"] });
    return flags;
  }

  if (!isFinite(ev) || ev <= EV_THRESHOLD) {
    flags.push({ type: "EV_NOT_ABOVE_THRESHOLD", ...RISK_FLAG_CONFIG["EV_NOT_ABOVE_THRESHOLD"] });
  }

  // Market disagreement: model and implied prob differ by more than 15pp
  if (Math.abs(modelProb - impliedProb) > 0.15) {
    flags.push({ type: "MARKET_DISAGREEMENT_EXTREME", ...RISK_FLAG_CONFIG["MARKET_DISAGREEMENT_EXTREME"] });
  }

  return flags;
}

/** Apply filters and sort to a signal array */
function applyFiltersAndSort(
  signals: ValueBetSignal[],
  filters: FilterState
): ValueBetSignal[] {
  let result = [...signals];

  if (filters.league) {
    result = result.filter((s) =>
      s.league.toLowerCase().includes(filters.league.toLowerCase())
    );
  }
  if (filters.market) {
    result = result.filter((s) => s.market === filters.market);
  }
  if (filters.bookmaker) {
    result = result.filter((s) =>
      s.bookmaker.toLowerCase().includes(filters.bookmaker.toLowerCase())
    );
  }
  if (filters.evThreshold !== "") {
    const threshold = parseFloat(filters.evThreshold) / 100;
    if (isFinite(threshold)) {
      result = result.filter((s) => s.ev >= threshold);
    }
  }
  if (filters.decision !== "ALL") {
    result = result.filter((s) => s.decision === filters.decision);
  }

  // Sort
  result.sort((a, b) => {
    switch (filters.sort as SortKey) {
      case "ev_desc":
        return b.ev - a.ev;
      case "ev_asc":
        return a.ev - b.ev;
      case "edge_desc":
        return b.edgePct - a.edgePct;
      case "model_prob_desc":
        return b.modelProb - a.modelProb;
      case "market_agreement":
        // Smallest absolute difference between model and implied = strongest agreement
        return Math.abs(a.modelProb - a.impliedProb) - Math.abs(b.modelProb - b.impliedProb);
      default:
        return b.ev - a.ev;
    }
  });

  return result;
}

/** Build odds movement chart data from a selected signal's snapshots */
function buildOddsMovement(
  signal: ValueBetSignal | null,
  predictions: ApiPrediction[]
): Array<{ time: string; bookOdds: number; fairOdds: number }> {
  if (!signal) return [];

  const pred = predictions.find((p) => p.id === signal.id);
  const snapshots = pred?.match?.oddsSnapshots ?? [];

  if (snapshots.length === 0) {
    // Synthesise a flat line from fair price for display purposes
    const times = ["T-24h", "T-18h", "T-12h", "T-6h", "T-3h", "T-1h", "T-0"];
    return times.map((t) => ({
      time: t,
      bookOdds: signal.bestOdds,
      fairOdds: signal.fairPrice
    }));
  }

  return snapshots
    .slice()
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())
    .map((s) => ({
      time: new Date(s.capturedAt).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit"
      }),
      bookOdds: Number(s.priceDecimal),
      fairOdds: signal.fairPrice
    }));
}

// ─── Static demo signals (shown when API has no predictions) ──────────────────

const DEMO_SIGNALS: ValueBetSignal[] = [
  {
    id: "demo-1",
    match: "Celtics vs Heat",
    league: "NBA",
    market: "MONEYLINE",
    selection: "Miami Heat",
    bookmaker: "Pinnacle",
    modelProb: 0.42,
    impliedProb: 0.36,
    edgePct: 6.0,
    fairPrice: 2.381,
    bestOdds: 2.780,
    ev: 0.168,
    decision: "SIGNAL",
    riskFlags: []
  },
  {
    id: "demo-2",
    match: "Lakers vs Warriors",
    league: "NBA",
    market: "SPREAD",
    selection: "Lakers +4.5",
    bookmaker: "Pinnacle",
    modelProb: 0.55,
    impliedProb: 0.50,
    edgePct: 5.0,
    fairPrice: 1.818,
    bestOdds: 2.000,
    ev: 0.100,
    decision: "SIGNAL",
    riskFlags: []
  },
  {
    id: "demo-3",
    match: "Man City vs Arsenal",
    league: "EPL",
    market: "TOTAL",
    selection: "Under 2.5",
    bookmaker: "Bet365",
    modelProb: 0.52,
    impliedProb: 0.48,
    edgePct: 4.0,
    fairPrice: 1.923,
    bestOdds: 2.080,
    ev: 0.082,
    decision: "SIGNAL",
    riskFlags: []
  },
  {
    id: "demo-4",
    match: "Knicks vs Pacers",
    league: "NBA",
    market: "MONEYLINE",
    selection: "Pacers",
    bookmaker: "DraftKings",
    modelProb: 0.49,
    impliedProb: 0.48,
    edgePct: 1.0,
    fairPrice: 2.041,
    bestOdds: 2.080,
    ev: 0.019,
    decision: "NO_BET",
    riskFlags: [{ type: "EV_NOT_ABOVE_THRESHOLD", ...RISK_FLAG_CONFIG["EV_NOT_ABOVE_THRESHOLD"] }]
  },
  {
    id: "demo-5",
    match: "Liverpool vs Chelsea",
    league: "EPL",
    market: "MONEYLINE",
    selection: "Chelsea",
    bookmaker: "Pinnacle",
    modelProb: 0.28,
    impliedProb: 0.25,
    edgePct: 3.0,
    fairPrice: 3.571,
    bestOdds: 4.000,
    ev: 0.120,
    decision: "NO_BET",
    riskFlags: [{ type: "MARKET_DISAGREEMENT_EXTREME", ...RISK_FLAG_CONFIG["MARKET_DISAGREEMENT_EXTREME"] }]
  },
  {
    id: "demo-6",
    match: "Real Madrid vs Bayern",
    league: "UCL",
    market: "TOTAL",
    selection: "Over 3.0",
    bookmaker: "Bet365",
    modelProb: 0.58,
    impliedProb: 0.52,
    edgePct: 6.0,
    fairPrice: 1.724,
    bestOdds: 1.920,
    ev: 0.114,
    decision: "NO_BET",
    riskFlags: [{ type: "DATA_QUALITY_UNACCEPTABLE", ...RISK_FLAG_CONFIG["DATA_QUALITY_UNACCEPTABLE"] }]
  },
  {
    id: "demo-7",
    match: "Suns vs Mavericks",
    league: "NBA",
    market: "SPREAD",
    selection: "Suns -2.5",
    bookmaker: "FanDuel",
    modelProb: 0.48,
    impliedProb: 0.52,
    edgePct: -4.0,
    fairPrice: 2.083,
    bestOdds: 1.920,
    ev: -0.078,
    decision: "NO_BET",
    riskFlags: [{ type: "EV_NOT_ABOVE_THRESHOLD", ...RISK_FLAG_CONFIG["EV_NOT_ABOVE_THRESHOLD"] }]
  },
  {
    id: "demo-8",
    match: "Bayern vs Dortmund",
    league: "Bundesliga",
    market: "MONEYLINE",
    selection: "Bayern Munich",
    bookmaker: "Pinnacle",
    modelProb: 0.61,
    impliedProb: 0.55,
    edgePct: 6.0,
    fairPrice: 1.639,
    bestOdds: 1.820,
    ev: 0.110,
    decision: "SIGNAL",
    riskFlags: []
  }
];

const DEMO_ODDS_MOVEMENT = [
  { time: "08:00", bookOdds: 2.55, fairOdds: 2.38 },
  { time: "09:30", bookOdds: 2.50, fairOdds: 2.38 },
  { time: "11:00", bookOdds: 2.52, fairOdds: 2.38 },
  { time: "12:30", bookOdds: 2.58, fairOdds: 2.38 },
  { time: "14:00", bookOdds: 2.62, fairOdds: 2.38 },
  { time: "15:30", bookOdds: 2.60, fairOdds: 2.38 },
  { time: "17:00", bookOdds: 2.68, fairOdds: 2.38 },
  { time: "18:30", bookOdds: 2.72, fairOdds: 2.38 },
  { time: "20:00", bookOdds: 2.70, fairOdds: 2.38 },
  { time: "21:30", bookOdds: 2.78, fairOdds: 2.38 }
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ValueBetsPage() {
  const [rawPredictions, setRawPredictions] = useState<ApiPrediction[]>([]);
  const [allSignals, setAllSignals] = useState<ValueBetSignal[]>(DEMO_SIGNALS);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(true);

  const [filters, setFilters] = useState<FilterState>(FILTER_DEFAULTS);
  const [selectedId, setSelectedId] = useState<string | null>(DEMO_SIGNALS[0].id);

  // ── Fetch predictions ──
  const fetchPredictions = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${API}/predictions`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load predictions.");

      const predictions: ApiPrediction[] = json.data ?? [];
      setRawPredictions(predictions);

      if (predictions.length > 0) {
        const signals = predictions.map(toSignal);
        setAllSignals(signals);
        setSelectedId(signals[0]?.id ?? null);
        setIsDemo(false);
      } else {
        // No DB predictions — keep demo data
        setAllSignals(DEMO_SIGNALS);
        setSelectedId(DEMO_SIGNALS[0].id);
        setIsDemo(true);
      }
    } catch {
      // API unavailable — fall back to demo data silently
      setAllSignals(DEMO_SIGNALS);
      setSelectedId(DEMO_SIGNALS[0].id);
      setIsDemo(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  // ── Filtered + sorted signals ──
  const filteredSignals = useMemo(
    () => applyFiltersAndSort(allSignals, filters),
    [allSignals, filters]
  );

  // ── Selected signal ──
  const selectedSignal = useMemo(
    () => filteredSignals.find((s) => s.id === selectedId) ?? filteredSignals[0] ?? null,
    [filteredSignals, selectedId]
  );

  // ── Derived filter options (from full unfiltered set) ──
  const leagues = useMemo(
    () => [...new Set(allSignals.map((s) => s.league).filter(Boolean))].sort(),
    [allSignals]
  );
  const bookmakers = useMemo(
    () => [...new Set(allSignals.map((s) => s.bookmaker).filter(Boolean))].sort(),
    [allSignals]
  );

  // ── Aggregate stats (from full unfiltered set) ──
  const activeSignals = allSignals.filter((s) => s.decision === "SIGNAL");
  const avgEdge =
    activeSignals.length > 0
      ? activeSignals.reduce((sum, s) => sum + s.edgePct, 0) / activeSignals.length
      : 0;
  const avgEv =
    activeSignals.length > 0
      ? activeSignals.reduce((sum, s) => sum + s.ev, 0) / activeSignals.length
      : 0;

  // ── Odds movement chart data ──
  const oddsMovementData = useMemo(() => {
    if (!selectedSignal) return DEMO_ODDS_MOVEMENT;
    if (isDemo) return DEMO_ODDS_MOVEMENT;
    return buildOddsMovement(selectedSignal, rawPredictions);
  }, [selectedSignal, isDemo, rawPredictions]);

  // ── Tooltip style ──
  const tooltipStyle = {
    backgroundColor: "#10141d",
    borderColor: "#222e3f",
    color: "#e2e8f0",
    fontFamily: "JetBrains Mono, monospace",
    fontSize: "11px"
  };

  return (
    <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-[#222e3f] pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400 font-mono">
            QUANTITATIVE ANALYSIS
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100 font-mono">
            VALUE // ANALYSIS
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isDemo && (
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded px-2.5 py-1.5">
              <FlaskConical className="h-3 w-3" />
              DEMO DATA
            </span>
          )}
          <button
            onClick={fetchPredictions}
            disabled={isLoading}
            aria-label="Refresh predictions"
            className="p-2 text-slate-500 hover:text-slate-200 border border-[#222e3f] rounded hover:border-slate-600 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Model uncertainty notice */}
      <VarianceNotice
        type="caution"
        message="Irreducible Model Uncertainty"
        detail="Probability estimates represent long-run frequency calibrations, not single-event certainties. A signal is a mathematical edge, not a guaranteed outcome. Maintain bankroll discipline at all times."
      />

      {/* Fetch error */}
      {fetchError && (
        <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/30 rounded px-4 py-3 text-xs text-rose-400 font-mono">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {fetchError}
        </div>
      )}

      {/* Stats row */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <StatCard
          label="Active Signals"
          value={isLoading ? "—" : activeSignals.length.toString()}
          subtitle="Clears EV threshold and risk filters"
          icon={Shield}
        />
        <StatCard
          label="Average Edge"
          value={
            isLoading
              ? "—"
              : activeSignals.length > 0
              ? `${avgEdge > 0 ? "+" : ""}${avgEdge.toFixed(2)}pp`
              : "—"
          }
          subtitle="Model prob − implied prob (active signals)"
          icon={TrendingUp}
          trend={activeSignals.length > 0 ? (avgEdge > 0 ? "up" : "down") : undefined}
        />
        <StatCard
          label="Average EV"
          value={
            isLoading
              ? "—"
              : activeSignals.length > 0
              ? `${avgEv > 0 ? "+" : ""}${(avgEv * 100).toFixed(2)}%`
              : "—"
          }
          subtitle="Expected value across active signals"
          icon={Percent}
          trend={activeSignals.length > 0 ? (avgEv > 0 ? "up" : "down") : undefined}
        />
      </div>

      {/* Filters */}
      <Filters
        filters={filters}
        onChange={setFilters}
        leagues={leagues}
        bookmakers={bookmakers}
        activeCount={filteredSignals.length}
        totalCount={allSignals.length}
      />

      {/* Signal table */}
      <Panel
        title="Mathematical Edge Signals"
        action={
          <span className="text-[10px] font-mono text-slate-500">
            {filteredSignals.length} result{filteredSignals.length !== 1 ? "s" : ""}
          </span>
        }
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-500 font-mono text-xs">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading signals...
          </div>
        ) : (
          <ValueBetTable
            signals={filteredSignals}
            selectedId={selectedId}
            onSelect={(s) => setSelectedId(s.id)}
          />
        )}
      </Panel>

      {/* Odds divergence chart — updates on row selection */}
      {selectedSignal && (
        <Panel
          title={`Odds Divergence // ${selectedSignal.match}`}
          action={
            <span className="text-[10px] font-mono text-slate-500">
              {selectedSignal.market} — {selectedSignal.selection}
            </span>
          }
        >
          <div className="space-y-3">
            {/* Context line */}
            <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-500">
              <span>
                Model fair price:{" "}
                <span className="text-slate-300 font-semibold">
                  {selectedSignal.fairPrice.toFixed(3)}
                </span>
              </span>
              <span>
                Best odds:{" "}
                <span className="text-slate-300 font-semibold">
                  {selectedSignal.bestOdds.toFixed(3)}
                </span>
              </span>
              <span>
                EV:{" "}
                <span
                  className={
                    selectedSignal.ev > 0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"
                  }
                >
                  {selectedSignal.ev > 0 ? "+" : ""}
                  {(selectedSignal.ev * 100).toFixed(2)}%
                </span>
              </span>
              <span>
                Decision:{" "}
                <span
                  className={
                    selectedSignal.decision === "SIGNAL"
                      ? "text-sky-400 font-semibold"
                      : "text-slate-500 font-semibold"
                  }
                >
                  {selectedSignal.decision}
                </span>
              </span>
            </div>

            {/* Chart */}
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 0, height: 224 }}>
                <LineChart
                  data={oddsMovementData}
                  margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d2836" />
                  <XAxis
                    dataKey="time"
                    stroke="#475569"
                    fontSize={10}
                    fontFamily="JetBrains Mono"
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    stroke="#475569"
                    fontSize={10}
                    fontFamily="JetBrains Mono"
                    tickFormatter={(v) => v.toFixed(2)}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number, name: string) => [
                      v.toFixed(3),
                      name === "bookOdds" ? "Book odds" : "Fair price"
                    ]}
                  />
                  {/* Value zone: where book odds exceed fair price */}
                  {selectedSignal.bestOdds > selectedSignal.fairPrice && (
                    <ReferenceArea
                      y1={selectedSignal.fairPrice}
                      y2={selectedSignal.bestOdds * 1.02}
                      fill="#10b981"
                      fillOpacity={0.04}
                    />
                  )}
                  {/* Fair price reference line */}
                  <ReferenceLine
                    y={selectedSignal.fairPrice}
                    stroke="#475569"
                    strokeDasharray="4 4"
                    opacity={0.6}
                    label={{
                      value: "Fair",
                      position: "insideTopRight",
                      fill: "#475569",
                      fontSize: 9,
                      fontFamily: "JetBrains Mono"
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="bookOdds"
                    name="bookOdds"
                    stroke="#0ea5e9"
                    strokeWidth={1.5}
                    dot={{ r: 3, fill: "#0ea5e9", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="fairOdds"
                    name="fairOdds"
                    stroke="#475569"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 text-[10px] font-mono text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-sky-500 inline-block" />
                Bookmaker odds
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-slate-500 inline-block opacity-60" style={{ borderTop: "1px dashed" }} />
                Model fair price
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-3 bg-emerald-500/20 border border-emerald-500/20 inline-block rounded-sm" />
                Value zone
              </span>
            </div>
          </div>
        </Panel>
      )}

      {/* Methodology note */}
      <div className="text-[10px] font-mono text-slate-600 border-t border-[#222e3f]/40 pt-4 space-y-1">
        <p>
          <span className="text-slate-500">EV</span> = (model probability × decimal odds) − 1.
          Signals require EV &gt; {(EV_THRESHOLD * 100).toFixed(0)}% and no active risk flags.
        </p>
        <p>
          <span className="text-slate-500">Edge</span> = model probability − bookmaker implied probability (percentage points).
          Implied probability is raw (includes bookmaker margin).
        </p>
        <p>
          <span className="text-slate-500">Market disagreement</span> flag triggers when model and implied probability diverge by more than 15pp.
          This indicates elevated model risk, not necessarily a bad bet.
        </p>
      </div>
    </main>
  );
}
