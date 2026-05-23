"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  TrendingUp,
  Percent,
  Activity,
  Coins,
  Plus,
  RefreshCw,
  AlertCircle,
  Loader2,
  X,
  CheckCircle
} from "lucide-react";

import StatCard from "../components/StatCard";
import Panel from "../components/Panel";
import VarianceNotice from "../components/VarianceNotice";
import BetForm, { BetFormValues } from "../components/bets/BetForm";
import BetTable, { TrackedBetRow } from "../components/bets/BetTable";
import { useAuth } from "../context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SummaryStats {
  totalBets: number;
  resolvedCount: number;
  winCount: number;
  lossCount: number;
  winRate: number | null;
  totalStaked: number;
  netPnl: number;
  roi: number | null;
  avgClvPct: number | null;
  clvSampleSize: number;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function apiFetch(path: string, token: string | null, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>)
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers, credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

// ─── Settle Modal ─────────────────────────────────────────────────────────────

interface SettleModalProps {
  bet: TrackedBetRow;
  onConfirm: (outcome: string, closingPrice: string) => Promise<void>;
  onClose: () => void;
}

function SettleModal({ bet, onConfirm, onClose }: SettleModalProps) {
  const [outcome, setOutcome] = useState("WON");
  const [closingPrice, setClosingPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const matchLabel = bet.match
    ? `${bet.match.homeTeam.name} vs ${bet.match.awayTeam.name}`
    : "—";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onConfirm(outcome, closingPrice);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to settle bet.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm bg-[#10141d] border border-[#222e3f] rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#222e3f] bg-[#0c0f16]">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-300">
            SETTLE BET
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Bet summary */}
          <div className="bg-[#0c0f16] border border-[#222e3f] rounded p-3 text-xs font-mono space-y-1">
            <div className="text-slate-400">{matchLabel}</div>
            <div className="text-slate-200 font-semibold">
              {bet.market} — {bet.selection}
            </div>
            <div className="text-slate-500">
              {bet.stakeUnits.toFixed(2)}u @ {bet.priceDecimal.toFixed(2)}
            </div>
          </div>

          {/* Outcome */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-mono font-bold uppercase tracking-widest text-slate-400">
              Outcome <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {["WON", "LOST", "PUSH", "VOID"].map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOutcome(o)}
                  className={`py-2 text-[10px] font-mono font-bold rounded border transition-colors ${
                    outcome === o
                      ? o === "WON"
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                        : o === "LOST"
                        ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
                        : o === "PUSH"
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                        : "bg-slate-800 border-slate-600 text-slate-400"
                      : "bg-transparent border-[#222e3f] text-slate-500 hover:border-slate-600"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* Closing price */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-mono font-bold uppercase tracking-widest text-slate-400">
              Closing Odds (decimal){" "}
              <span className="text-slate-600 normal-case tracking-normal font-normal">
                — for CLV calculation
              </span>
            </label>
            <input
              type="number"
              step="0.01"
              min="1.01"
              value={closingPrice}
              onChange={(e) => setClosingPrice(e.target.value)}
              placeholder="e.g. 1.95"
              className="w-full bg-[#080a0f] border border-[#222e3f] rounded px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-colors"
            />
            {closingPrice && !isNaN(parseFloat(closingPrice)) && parseFloat(closingPrice) > 1 && (
              <p className="text-[10px] font-mono text-slate-500">
                CLV:{" "}
                <span
                  className={
                    bet.priceDecimal / parseFloat(closingPrice) - 1 > 0
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }
                >
                  {((bet.priceDecimal / parseFloat(closingPrice) - 1) * 100).toFixed(2)}%
                </span>
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded px-3 py-2 text-xs text-rose-400 font-mono">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-mono font-bold uppercase tracking-widest text-slate-400 border border-[#222e3f] rounded hover:border-slate-600 transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-mono font-bold uppercase tracking-widest bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded transition-colors"
            >
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              CONFIRM
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BetTrackerPage() {
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [bets, setBets] = useState<TrackedBetRow[]>([]);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Modal state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editTarget, setEditTarget] = useState<TrackedBetRow | null>(null);
  const [settleTarget, setSettleTarget] = useState<TrackedBetRow | null>(null);

  // ── Fetch bets ──
  const fetchBets = useCallback(async () => {
    if (!isAuthenticated || !token) return;
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await apiFetch("/bets", token);
      setBets(data.data ?? []);
      setStats(data.stats ?? null);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "Failed to load bets.");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (!authLoading) fetchBets();
  }, [authLoading, fetchBets]);

  // ── Create ──
  async function handleCreate(values: BetFormValues) {
    await apiFetch("/bets", token, {
      method: "POST",
      body: JSON.stringify({
        matchDescription: values.matchDescription,
        leagueName: values.leagueName || undefined,
        market: values.market,
        selection: values.selection,
        stakeUnits: parseFloat(values.stakeUnits),
        priceDecimal: parseFloat(values.priceDecimal),
        bookmakerName: values.bookmakerName || undefined,
        modelFairProbability: values.modelFairProbability
          ? parseFloat(values.modelFairProbability)
          : undefined,
        placedAt: values.placedAt || undefined
      })
    });
    setShowCreateForm(false);
    await fetchBets();
  }

  // ── Edit ──
  async function handleEdit(values: BetFormValues) {
    if (!editTarget) return;
    await apiFetch(`/bets/${editTarget.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({
        market: values.market,
        selection: values.selection,
        stakeUnits: parseFloat(values.stakeUnits),
        priceDecimal: parseFloat(values.priceDecimal),
        bookmakerName: values.bookmakerName || undefined,
        modelFairProbability: values.modelFairProbability
          ? parseFloat(values.modelFairProbability)
          : undefined,
        placedAt: values.placedAt || undefined
      })
    });
    setEditTarget(null);
    await fetchBets();
  }

  // ── Settle ──
  async function handleSettle(outcome: string, closingPrice: string) {
    if (!settleTarget) return;
    await apiFetch(`/bets/${settleTarget.id}/settle`, token, {
      method: "PATCH",
      body: JSON.stringify({
        outcome,
        closingPriceDecimal: closingPrice ? parseFloat(closingPrice) : undefined
      })
    });
    setSettleTarget(null);
    await fetchBets();
  }

  // ── Void ──
  async function handleVoid(bet: TrackedBetRow) {
    if (!confirm(`Void bet: ${bet.selection} on ${bet.match ? `${bet.match.homeTeam.name} vs ${bet.match.awayTeam.name}` : "—"}? This preserves the historical record.`)) return;
    await apiFetch(`/bets/${bet.id}`, token, { method: "DELETE" });
    await fetchBets();
  }

  // ── Edit initial values ──
  function editInitialValues(bet: TrackedBetRow): Partial<BetFormValues> {
    return {
      matchDescription: bet.match
        ? `${bet.match.homeTeam.name} vs ${bet.match.awayTeam.name}`
        : "",
      leagueName: bet.match?.league?.name ?? "",
      market: bet.market,
      selection: bet.selection,
      stakeUnits: bet.stakeUnits.toString(),
      priceDecimal: bet.priceDecimal.toString(),
      bookmakerName: bet.bookmaker?.name ?? "",
      modelFairProbability:
        bet.evAtEntry != null
          ? "" // EV is stored, but we don't reverse-engineer prob
          : "",
      placedAt: bet.placedAt
        ? new Date(bet.placedAt).toISOString().slice(0, 16)
        : ""
    };
  }

  // ── Derived display stats ──
  const displayStats = {
    totalBets: stats?.totalBets ?? 0,
    winRate:
      stats?.winRate != null ? `${(stats.winRate * 100).toFixed(1)}%` : "—",
    roi: stats?.roi != null ? `${stats.roi > 0 ? "+" : ""}${(stats.roi * 100).toFixed(1)}%` : "—",
    totalStaked: stats?.totalStaked != null ? `${stats.totalStaked.toFixed(1)}u` : "—",
    netPnl:
      stats?.netPnl != null
        ? `${stats.netPnl > 0 ? "+" : ""}${stats.netPnl.toFixed(2)}u`
        : "—",
    avgClv:
      stats?.avgClvPct != null
        ? `${stats.avgClvPct > 0 ? "+" : ""}${(stats.avgClvPct * 100).toFixed(2)}%`
        : "—"
  };

  const pnlTrend =
    stats?.netPnl != null
      ? stats.netPnl > 0
        ? "up"
        : stats.netPnl < 0
        ? "down"
        : "flat"
      : undefined;

  return (
    <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-[#222e3f] pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400 font-mono">
            PORTFOLIO LEDGER
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100 font-mono">
            BET // TRACKER
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchBets}
            disabled={isLoading}
            aria-label="Refresh bets"
            className="p-2 text-slate-500 hover:text-slate-200 border border-[#222e3f] rounded hover:border-slate-600 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-bold uppercase tracking-widest rounded transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            LOG BET
          </button>
        </div>
      </div>

      {/* Variance notice */}
      {stats && stats.totalBets < 200 && (
        <VarianceNotice
          type="info"
          message="Short-Term Variance Notice"
          detail={`Metrics based on ${stats.totalBets} tracked bet${stats.totalBets !== 1 ? "s" : ""}. Minimum N=200 recommended for statistically significant CLV and ROI validation.`}
        />
      )}

      {/* Fetch error */}
      {fetchError && (
        <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/30 rounded px-4 py-3 text-xs text-rose-400 font-mono">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Stats row */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Bets" value={displayStats.totalBets} icon={Activity} />
        <StatCard label="Win Rate" value={displayStats.winRate} icon={Percent} />
        <StatCard
          label="Total ROI"
          value={displayStats.roi}
          icon={TrendingUp}
          trend={
            stats?.roi != null
              ? stats.roi > 0
                ? "up"
                : stats.roi < 0
                ? "down"
                : "flat"
              : undefined
          }
        />
        <StatCard label="Total Staked" value={displayStats.totalStaked} icon={Coins} />
        <StatCard
          label="Net P&L"
          value={displayStats.netPnl}
          icon={TrendingUp}
          trend={pnlTrend}
        />
        <StatCard
          label="Avg CLV"
          value={displayStats.avgClv}
          subtitle={stats?.clvSampleSize ? `${stats.clvSampleSize} settled` : undefined}
          icon={TrendingUp}
          trend={
            stats?.avgClvPct != null
              ? stats.avgClvPct > 0
                ? "up"
                : stats.avgClvPct < 0
                ? "down"
                : "flat"
              : undefined
          }
        />
      </div>

      {/* Bet ledger */}
      <Panel
        title="Bet Ledger"
        action={
          <span className="text-[10px] font-mono text-slate-500">
            {bets.length} record{bets.length !== 1 ? "s" : ""}
          </span>
        }
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-500 font-mono text-xs">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading bets...
          </div>
        ) : (
          <BetTable
            bets={bets}
            onEdit={(bet) => setEditTarget(bet)}
            onSettle={(bet) => setSettleTarget(bet)}
            onVoid={handleVoid}
          />
        )}
      </Panel>

      {/* Modals */}
      {showCreateForm && (
        <BetForm
          mode="create"
          onSubmit={handleCreate}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      {editTarget && (
        <BetForm
          mode="edit"
          initialValues={editInitialValues(editTarget)}
          onSubmit={handleEdit}
          onClose={() => setEditTarget(null)}
        />
      )}

      {settleTarget && (
        <SettleModal
          bet={settleTarget}
          onConfirm={handleSettle}
          onClose={() => setSettleTarget(null)}
        />
      )}
    </main>
  );
}
