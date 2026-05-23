"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  RefreshCw,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  Activity,
  TrendingUp,
  FlaskConical,
  Radio
} from "lucide-react";
import Link from "next/link";

import Panel from "../../components/Panel";
import VarianceNotice from "../../components/VarianceNotice";
import OddsChart, {
  OddsSnapshot,
  ModelPrediction as OddsModelPrediction
} from "../../components/matches/OddsChart";
import ProbabilityPanel, {
  PredictionRow,
  SnapshotRow
} from "../../components/matches/ProbabilityPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchDetail {
  id: string;
  status: "SCHEDULED" | "LIVE" | "FINAL" | "POSTPONED" | "CANCELLED";
  startsAt: string;
  homeScore: number | null;
  awayScore: number | null;
  league: { name: string; sport: string };
  homeTeam: { name: string };
  awayTeam: { name: string };
  oddsSnapshots: Array<{
    id: string;
    market: string;
    selection: string;
    priceDecimal: string | number;
    impliedProb: string | number;
    bookmakerMargin: string | number;
    capturedAt: string;
    bookmaker: { name: string };
  }>;
  modelPredictions: Array<{
    id: string;
    market: string;
    selection: string;
    fairProbability: string | number;
    fairPriceDecimal: string | number;
    edgePct: string | number;
    rationale: string | null;
    createdAt: string;
  }>;
}

// ─── Demo data ────────────────────────────────────────────────────────────────

function buildDemoMatch(id: string): MatchDetail {
  const now = new Date();
  const snapTimes = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(now);
    d.setHours(d.getHours() - (8 - i));
    return d.toISOString();
  });

  return {
    id,
    status: "SCHEDULED",
    startsAt: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    homeScore: null,
    awayScore: null,
    league: { name: "NBA", sport: "basketball_nba" },
    homeTeam: { name: "Boston Celtics" },
    awayTeam: { name: "Miami Heat" },
    oddsSnapshots: [
      ...snapTimes.map((t, i) => ({
        id: `snap-home-${i}`,
        market: "MONEYLINE",
        selection: "HOME",
        priceDecimal: (1.55 + i * 0.01).toFixed(3),
        impliedProb: (1 / (1.55 + i * 0.01)).toFixed(6),
        bookmakerMargin: "0.042",
        capturedAt: t,
        bookmaker: { name: "Pinnacle" }
      })),
      ...snapTimes.map((t, i) => ({
        id: `snap-away-${i}`,
        market: "MONEYLINE",
        selection: "AWAY",
        priceDecimal: (2.55 - i * 0.02).toFixed(3),
        impliedProb: (1 / (2.55 - i * 0.02)).toFixed(6),
        bookmakerMargin: "0.042",
        capturedAt: t,
        bookmaker: { name: "Pinnacle" }
      })),
      ...snapTimes.slice(0, 4).map((t, i) => ({
        id: `snap-dk-home-${i}`,
        market: "MONEYLINE",
        selection: "HOME",
        priceDecimal: (1.53 + i * 0.01).toFixed(3),
        impliedProb: (1 / (1.53 + i * 0.01)).toFixed(6),
        bookmakerMargin: "0.048",
        capturedAt: t,
        bookmaker: { name: "DraftKings" }
      })),
      ...snapTimes.slice(0, 4).map((t, i) => ({
        id: `snap-total-over-${i}`,
        market: "TOTAL",
        selection: "OVER_224.5",
        priceDecimal: (1.91 + i * 0.005).toFixed(3),
        impliedProb: (1 / (1.91 + i * 0.005)).toFixed(6),
        bookmakerMargin: "0.045",
        capturedAt: t,
        bookmaker: { name: "Pinnacle" }
      }))
    ],
    modelPredictions: [
      {
        id: "pred-home",
        market: "MONEYLINE",
        selection: "HOME",
        fairProbability: "0.620",
        fairPriceDecimal: "1.613",
        edgePct: "0.0",
        rationale: "Deterministic basketball model: home_pts=116.5, away_pts=111.2, margin=5.3, total=227.7",
        createdAt: now.toISOString()
      },
      {
        id: "pred-away",
        market: "MONEYLINE",
        selection: "AWAY",
        fairProbability: "0.380",
        fairPriceDecimal: "2.632",
        edgePct: "0.042",
        rationale: "Deterministic basketball model: home_pts=116.5, away_pts=111.2, margin=5.3, total=227.7",
        createdAt: now.toISOString()
      },
      {
        id: "pred-over",
        market: "TOTAL",
        selection: "OVER_224.5",
        fairProbability: "0.510",
        fairPriceDecimal: "1.961",
        edgePct: "0.0",
        rationale: null,
        createdAt: now.toISOString()
      },
      {
        id: "pred-under",
        market: "TOTAL",
        selection: "UNDER_224.5",
        fairProbability: "0.490",
        fairPriceDecimal: "2.041",
        edgePct: "0.0",
        rationale: null,
        createdAt: now.toISOString()
      }
    ]
  };
}

// ─── Risk flags derived from match data ───────────────────────────────────────

interface RiskFlag {
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
}

function selectionLabel(selection: string, match: MatchDetail) {
  if (selection === "HOME") return match.homeTeam.name;
  if (selection === "AWAY") return match.awayTeam.name;
  return selection.replace("_", " ");
}

function snapshotSelection(selection: string, market: string, match: MatchDetail) {
  if (market === "MONEYLINE") {
    if (selection === "HOME") return match.homeTeam.name;
    if (selection === "AWAY") return match.awayTeam.name;
  }
  if (market === "TOTAL") {
    const total = selection.match(/^(OVER|UNDER)_(\d+(?:\.\d+)?)$/);
    if (total) return `${titleCase(total[1])} ${formatLine(total[2])}`;
  }
  if (market === "SPREAD") {
    const homeSpread = selection.match(/^HOME_([+-]?\d+(?:\.\d+)?)$/);
    const awaySpread = selection.match(/^AWAY_([+-]?\d+(?:\.\d+)?)$/);
    if (homeSpread) return `${match.homeTeam.name} ${formatBookLine(homeSpread[1])}`;
    if (awaySpread) return `${match.awayTeam.name} ${formatBookLine(awaySpread[1])}`;
  }
  return selection;
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatBookLine(value: string) {
  return formatLine(value).replace(/^\+/, "");
}

function formatLine(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return Number.isInteger(numeric) ? String(numeric) : String(numeric);
}

function latestSnapshot(
  snapshots: MatchDetail["oddsSnapshots"],
  market: string,
  selection: string,
  match: MatchDetail
) {
  const normalizedSelection = snapshotSelection(selection, market, match);
  return snapshots
    .filter((s) => s.market === market && s.selection === normalizedSelection)
    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
}

function bestSnapshot(
  snapshots: MatchDetail["oddsSnapshots"],
  market: string,
  selection: string,
  match: MatchDetail
) {
  const normalizedSelection = snapshotSelection(selection, market, match);
  return snapshots
    .filter((s) => s.market === market && s.selection === normalizedSelection)
    .sort((a, b) => Number(b.priceDecimal) - Number(a.priceDecimal))[0];
}

function hoursUntilStart(startsAt: string) {
  const time = new Date(startsAt).getTime();
  if (!Number.isFinite(time)) return null;
  return (time - Date.now()) / (1000 * 60 * 60);
}

function deriveRiskFlags(match: MatchDetail): RiskFlag[] {
  const flags: RiskFlag[] = [];

  // Check current model-market disagreement against the latest line.
  for (const pred of match.modelPredictions) {
    const snap = latestSnapshot(match.oddsSnapshots, pred.market, pred.selection, match);
    if (!snap) continue;
    const delta = Math.abs(Number(pred.fairProbability) - Number(snap.impliedProb));
    const label = selectionLabel(pred.selection, match);
    if (delta > 0.15) {
      flags.push({
        type: "MARKET_DISAGREEMENT_EXTREME",
        severity: "high",
        message: `Model and market diverge by ${(delta * 100).toFixed(1)}pp on ${label}. Elevated model risk.`
      });
    } else if (delta > 0.08) {
      flags.push({
        type: "MARKET_DISAGREEMENT_MODERATE",
        severity: "medium",
        message: `Moderate model-market divergence (${(delta * 100).toFixed(1)}pp) on ${label}.`
      });
    }
  }

  // No odds data
  if (match.oddsSnapshots.length === 0) {
    flags.push({
      type: "MISSING_ODDS",
      severity: "high",
      message: "No bookmaker odds available. EV calculations are unavailable."
    });
  }

  // No model predictions
  if (match.modelPredictions.length === 0) {
    flags.push({
      type: "NO_MODEL_PREDICTIONS",
      severity: "high",
      message: "No model predictions available. Run the basketball prediction worker to generate estimates."
    });
  }

  // Single bookmaker only
  const bookmakers = new Set(match.oddsSnapshots.map((s) => s.bookmaker.name));
  if (bookmakers.size === 1 && match.oddsSnapshots.length > 0) {
    flags.push({
      type: "SINGLE_BOOKMAKER",
      severity: "low",
      message: "Only one bookmaker line available. Best-odds comparison is limited."
    });
  }

  const hours = hoursUntilStart(match.startsAt);
  if (match.status === "SCHEDULED" && hours != null && hours > 0 && hours <= 6) {
    flags.push({
      type: "LINEUP_UNCONFIRMED",
      severity: "medium",
      message: "Lineup feed is not connected inside six hours of start. Treat player-availability assumptions as uncertain."
    });
  }

  return flags;
}

// ─── Analyst notes ────────────────────────────────────────────────────────────

function buildAnalystNotes(match: MatchDetail): string[] {
  const notes: string[] = [];

  // Edge detection
  for (const pred of match.modelPredictions) {
    const snap = bestSnapshot(match.oddsSnapshots, pred.market, pred.selection, match);
    if (!snap) continue;
    const ev = Number(pred.fairProbability) * Number(snap.priceDecimal) - 1;
    if (ev > 0.05) {
      const label = selectionLabel(pred.selection, match);
      notes.push(
        `Model identifies positive EV (+${(ev * 100).toFixed(2)}%) on ${label} at best available market price. ` +
        `Fair price: ${Number(pred.fairPriceDecimal).toFixed(3)}, best available: ${Number(snap.priceDecimal).toFixed(3)}.`
      );
    }
  }

  // Odds movement
  const homeSnaps = match.oddsSnapshots
    .filter((s) => s.market === "MONEYLINE" && s.selection === match.homeTeam.name)
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());

  if (homeSnaps.length >= 2) {
    const first = Number(homeSnaps[0].priceDecimal);
    const last = Number(homeSnaps[homeSnaps.length - 1].priceDecimal);
    const move = ((last - first) / first) * 100;
    if (Math.abs(move) > 2) {
      notes.push(
        `${match.homeTeam.name} moneyline has moved ${move > 0 ? "out" : "in"} by ${Math.abs(move).toFixed(1)}% ` +
        `(${first.toFixed(3)} → ${last.toFixed(3)}). ` +
        `${move < 0 ? "Shortening line suggests sharp money or public action on home side." : "Drifting line may indicate reduced confidence or injury news."}`
      );
    }
  }

  // Expected-points note from rationale
  const rationale = match.modelPredictions.find((p) => p.rationale)?.rationale;
  if (rationale) {
    const pointsMatch = rationale.match(/home_pts=([\d.]+).*away_pts=([\d.]+)/);
    if (pointsMatch) {
      const homePoints = parseFloat(pointsMatch[1]);
      const awayPoints = parseFloat(pointsMatch[2]);
      notes.push(
        `Basketball model inputs: ${match.homeTeam.name} projected ${homePoints.toFixed(1)} points, ` +
        `${match.awayTeam.name} projected ${awayPoints.toFixed(1)} points. ` +
        `${homePoints > awayPoints
          ? `Home side projects ${(homePoints - awayPoints).toFixed(1)} more points.`
          : `Away side projects ${(awayPoints - homePoints).toFixed(1)} more points.`
        }`
      );
    }
  }

  if (notes.length === 0) {
    notes.push("No significant analytical signals detected at current market prices.");
  }

  return notes;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  } catch {
    return iso;
  }
}

function statusConfig(status: MatchDetail["status"]) {
  switch (status) {
    case "LIVE":
      return { label: "LIVE", cls: "text-sky-400 border-sky-500/20 bg-sky-500/5 animate-pulse-subtle" };
    case "FINAL":
      return { label: "FINAL", cls: "text-slate-500 border-slate-800 bg-slate-900" };
    case "POSTPONED":
      return { label: "POSTPONED", cls: "text-amber-400 border-amber-500/20 bg-amber-500/5" };
    case "CANCELLED":
      return { label: "CANCELLED", cls: "text-rose-400 border-rose-500/20 bg-rose-500/5" };
    default:
      return { label: "SCHEDULED", cls: "text-slate-400 border-[#222e3f] bg-[#151b26]" };
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params?.id as string;

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const fetchMatch = useCallback(async () => {
    if (!matchId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/matches/${matchId}`);
      if (res.status === 404) {
        // Use demo data for unknown IDs (e.g. mock IDs from the list page)
        setMatch(buildDemoMatch(matchId));
        setIsDemo(true);
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load match.");
      setMatch(json.data);
      setIsDemo(false);
    } catch {
      // Fall back to demo data on any network error
      setMatch(buildDemoMatch(matchId));
      setIsDemo(true);
    } finally {
      setIsLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchMatch();
  }, [fetchMatch]);

  // ── Derived data ──

  const riskFlags = useMemo(() => (match ? deriveRiskFlags(match) : []), [match]);
  const analystNotes = useMemo(() => (match ? buildAnalystNotes(match) : []), [match]);

  const oddsSnapshots: OddsSnapshot[] = useMemo(
    () =>
      (match?.oddsSnapshots ?? []).map((s) => ({
        ...s,
        priceDecimal: Number(s.priceDecimal),
        impliedProb: Number(s.impliedProb),
        bookmakerMargin: Number(s.bookmakerMargin)
      })),
    [match]
  );

  const modelPredictions: OddsModelPrediction[] = useMemo(
    () =>
      (match?.modelPredictions ?? []).map((p) => ({
        ...p,
        fairProbability: Number(p.fairProbability),
        fairPriceDecimal: Number(p.fairPriceDecimal),
        edgePct: Number(p.edgePct)
      })),
    [match]
  );

  const predictionRows: PredictionRow[] = useMemo(
    () =>
      (match?.modelPredictions ?? []).map((p) => ({
        ...p,
        fairProbability: Number(p.fairProbability),
        fairPriceDecimal: Number(p.fairPriceDecimal),
        edgePct: Number(p.edgePct)
      })),
    [match]
  );

  const snapshotRows: SnapshotRow[] = useMemo(
    () =>
      (match?.oddsSnapshots ?? []).map((s) => ({
        ...s,
        impliedProb: Number(s.impliedProb),
        bookmakerMargin: Number(s.bookmakerMargin)
      })),
    [match]
  );

  // Bookmaker margin summary
  const avgMargin = useMemo(() => {
    if (snapshotRows.length === 0) return null;
    const margins = snapshotRows.map((s) => s.bookmakerMargin).filter((m) => m > 0);
    if (margins.length === 0) return null;
    return margins.reduce((a, b) => a + b, 0) / margins.length;
  }, [snapshotRows]);

  const bookmakerCount = useMemo(
    () => new Set(oddsSnapshots.map((s) => s.bookmaker.name)).size,
    [oddsSnapshots]
  );

  // ── Loading / error states ──

  if (isLoading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500 font-mono text-xs">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading match data...
        </div>
      </main>
    );
  }

  if (!match) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center font-mono space-y-2">
          <p className="text-slate-400">Match not found.</p>
          <Link href="/matches" className="text-sky-400 text-xs hover:underline">
            ← Back to schedule
          </Link>
        </div>
      </main>
    );
  }

  const sc = statusConfig(match.status);
  const hasScore = match.homeScore != null && match.awayScore != null;

  return (
    <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 space-y-6">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <Link
          href="/matches"
          className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          MATCH SCHEDULE
        </Link>
        {isDemo && (
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5">
            <FlaskConical className="h-3 w-3" />
            DEMO DATA
          </span>
        )}
      </div>

      {/* Match header */}
      <div className="border border-[#222e3f] bg-[#10141d] rounded-lg overflow-hidden">
        {/* Top bar */}
        <div className="border-b border-[#222e3f] bg-[#0c0f16] px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 bg-[#151b26] border border-[#222e3f] px-2 py-0.5 rounded">
              {match.league.name}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
              <Clock className="h-3 w-3" />
              {formatDateTime(match.startsAt)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 rounded border px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-widest ${sc.cls}`}>
              {match.status === "LIVE" && <Radio className="h-2.5 w-2.5" />}
              {sc.label}
            </span>
            <button
              onClick={fetchMatch}
              aria-label="Refresh"
              className="p-1.5 text-slate-500 hover:text-slate-200 border border-[#222e3f] rounded transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Teams + score */}
        <div className="px-5 py-6">
          <div className="flex items-center justify-between gap-4">
            {/* Home */}
            <div className="flex-1 text-left">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">HOME</p>
              <p className="text-xl font-semibold font-mono text-slate-100 leading-tight">
                {match.homeTeam.name}
              </p>
            </div>

            {/* Score / VS */}
            <div className="text-center shrink-0">
              {hasScore ? (
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold font-mono text-slate-100">{match.homeScore}</span>
                  <span className="text-slate-600 font-mono">—</span>
                  <span className="text-3xl font-bold font-mono text-slate-100">{match.awayScore}</span>
                </div>
              ) : (
                <span className="text-slate-600 font-mono text-lg">vs</span>
              )}
            </div>

            {/* Away */}
            <div className="flex-1 text-right">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">AWAY</p>
              <p className="text-xl font-semibold font-mono text-slate-100 leading-tight">
                {match.awayTeam.name}
              </p>
            </div>
          </div>
        </div>

        {/* Meta row */}
        <div className="border-t border-[#222e3f]/40 px-5 py-2.5 bg-[#0c0f16]/30 flex flex-wrap gap-4 text-[10px] font-mono text-slate-500">
          <span>
            Bookmakers: <span className="text-slate-300">{bookmakerCount || "—"}</span>
          </span>
          <span>
            Odds snapshots: <span className="text-slate-300">{oddsSnapshots.length}</span>
          </span>
          <span>
            Model predictions: <span className="text-slate-300">{modelPredictions.length}</span>
          </span>
          {avgMargin != null && (
            <span>
              Avg margin: <span className="text-amber-400">{(avgMargin * 100).toFixed(2)}%</span>
            </span>
          )}
        </div>
      </div>

      {/* Risk flags */}
      {riskFlags.length > 0 && (
        <div className="space-y-2">
          {riskFlags.map((flag, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 rounded border px-4 py-3 text-xs font-mono ${
                flag.severity === "high"
                  ? "bg-rose-500/5 border-rose-500/20 text-rose-300"
                  : flag.severity === "medium"
                  ? "bg-amber-500/5 border-amber-500/20 text-amber-300"
                  : "bg-slate-900 border-slate-800 text-slate-400"
              }`}
            >
              {flag.severity === "high" ? (
                <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              ) : flag.severity === "medium" ? (
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              )}
              <div>
                <span className="font-bold uppercase tracking-wider text-[9px]">[{flag.type}]</span>
                <p className="mt-0.5">{flag.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main grid */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        {/* Odds movement charts — full width */}
        <div className="lg:col-span-12">
          <Panel title="Odds Movement & EV Analysis">
            <OddsChart
              snapshots={oddsSnapshots}
              predictions={modelPredictions}
              homeTeam={match.homeTeam.name}
              awayTeam={match.awayTeam.name}
            />
          </Panel>
        </div>

        {/* Probability panel — 7 cols */}
        <div className="lg:col-span-7">
          <Panel title="Model Probability Analysis">
            <ProbabilityPanel
              predictions={predictionRows}
              snapshots={snapshotRows}
              homeTeam={match.homeTeam.name}
              awayTeam={match.awayTeam.name}
            />
          </Panel>
        </div>

        {/* Analyst notes — 5 cols */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Adversarial analyst notes */}
          <Panel title="Adversarial Analyst Notes">
            <div className="space-y-3">
              {analystNotes.map((note, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 border border-[#222e3f] bg-[#0c0f16] rounded p-3"
                >
                  <span className="text-[9px] font-mono font-bold text-slate-600 mt-0.5 shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-[11px] font-mono text-slate-400 leading-relaxed">{note}</p>
                </div>
              ))}
              <p className="text-[9px] font-mono text-slate-600 pt-1">
                Notes are generated deterministically from model outputs and market data.
                They represent analytical observations, not recommendations.
              </p>
            </div>
          </Panel>

          {/* Lineup uncertainty notice */}
          <Panel title="Data Confidence">
            <div className="space-y-3 text-[11px] font-mono">
              <div className="flex items-start gap-2.5 text-slate-400">
                <Activity className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-500" />
                <span>
                  Lineup data is not integrated in the MVP. Probability estimates assume
                  full-strength squads. Adjust confidence accordingly for injury-affected matches.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-slate-400">
                <TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-500" />
                <span>
                  Model uses a deterministic basketball rating projection calibrated on historical
                  scoring rates. It does not incorporate in-game momentum, late injury news, or travel fatigue.
                </span>
              </div>
              <VarianceNotice
                type="caution"
                message="Single-event uncertainty"
                detail="Probability estimates are long-run frequency calibrations. Any single match outcome is subject to irreducible variance."
              />
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}
