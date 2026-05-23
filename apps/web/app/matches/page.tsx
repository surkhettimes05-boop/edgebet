"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Activity, Clock, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import Link from "next/link";
import Panel from "../components/Panel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiMatch {
  id: string;
  status: "SCHEDULED" | "LIVE" | "FINAL" | "POSTPONED" | "CANCELLED";
  startsAt: string;
  homeScore: number | null;
  awayScore: number | null;
  league: { name: string; sport: string };
  homeTeam: { name: string };
  awayTeam: { name: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MatchesPage() {
  const [matches, setMatches] = useState<ApiMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<string>("ALL");

  const fetchMatches = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${API}/matches`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load matches.");

      const apiMatches: ApiMatch[] = json.data ?? [];
      setMatches(apiMatches);
    } catch (error) {
      setMatches([]);
      setFetchError(error instanceof Error ? error.message : "Failed to load real match data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // ── Derived ──
  const leagues = ["ALL", ...Array.from(new Set(matches.map((m) => m.league.name))).sort()];

  const filteredMatches = matches.filter(
    (m) => selectedLeague === "ALL" || m.league.name === selectedLeague
  );

  return (
    <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-[#222e3f] pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400 font-mono">
            REAL-TIME DATA
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100 font-mono">
            MATCH // SCHEDULE
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchMatches}
            disabled={isLoading}
            aria-label="Refresh matches"
            className="p-2 text-slate-500 hover:text-slate-200 border border-[#222e3f] rounded hover:border-slate-600 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          {/* League filter */}
          <div className="flex items-center gap-1.5 bg-[#10141d] border border-[#222e3f] p-1 rounded">
            {leagues.map((league) => (
              <button
                key={league}
                onClick={() => setSelectedLeague(league)}
                className={`px-3 py-1 text-[10px] font-mono font-bold tracking-wider rounded transition-colors ${
                  selectedLeague === league
                    ? "bg-[#151b26] text-sky-400 border border-[#222e3f]"
                    : "text-slate-500 hover:text-slate-300 border border-transparent"
                }`}
              >
                {league}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {fetchError && (
        <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/30 rounded px-4 py-3 text-xs text-rose-400 font-mono">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {fetchError}
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-500 font-mono text-xs">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading matches...
        </div>
      ) : (
        /* Matches Grid/List */
        <div className="space-y-4">
          {filteredMatches.length === 0 ? (
            <div className="text-center py-16 text-slate-600 font-mono text-xs">
              No matches found for the selected filter.
            </div>
          ) : (
            filteredMatches.map((match) => {
              const isLive = match.status === "LIVE";
              const isFinal = match.status === "FINAL";
              const hasScore = match.homeScore != null && match.awayScore != null;

              const formattedTime = new Date(match.startsAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
              });
              const formattedDate = new Date(match.startsAt).toLocaleDateString([], {
                month: "short",
                day: "2-digit"
              });

              return (
                <div
                  key={match.id}
                  className="rounded border border-[#222e3f] bg-[#10141d] overflow-hidden flex flex-col hover:border-slate-600 transition-colors"
                >
                  {/* Card Top Row */}
                  <div className="border-b border-[#222e3f]/40 px-4 py-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2 bg-[#0c0f16]/30">
                    <div className="flex items-center gap-3">
                      <span className="bg-[#151b26] border border-[#222e3f] px-2 py-0.5 rounded font-mono text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        {match.league.name}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          {formattedDate} {formattedTime}
                        </span>
                      </div>
                    </div>

                    {/* Status Indicator */}
                    <div className="flex items-center gap-2">
                      {isLive ? (
                        <span className="flex items-center gap-1.5 rounded border border-sky-500/20 bg-sky-500/5 px-2 py-0.5 font-mono text-[9px] font-bold text-sky-400 uppercase tracking-widest animate-pulse-subtle">
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                          LIVE
                        </span>
                      ) : isFinal ? (
                        <span className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5 font-mono text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                          FINAL
                        </span>
                      ) : (
                        <span className="rounded border border-[#222e3f] bg-[#151b26] px-2 py-0.5 font-mono text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          {match.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Middle Row */}
                  <div className="p-4 flex items-center justify-between gap-4">
                    {/* Team Names */}
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-slate-200">{match.homeTeam.name}</span>
                        <span className="text-[10px] font-mono text-slate-500 uppercase">HOME</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-slate-200">{match.awayTeam.name}</span>
                        <span className="text-[10px] font-mono text-slate-500 uppercase">AWAY</span>
                      </div>
                    </div>

                    {/* Score (if final/live) */}
                    {hasScore && (
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-2xl font-bold font-mono text-slate-100">{match.homeScore}</span>
                        <span className="text-slate-600 font-mono">—</span>
                        <span className="text-2xl font-bold font-mono text-slate-100">{match.awayScore}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Row */}
                  <div className="border-t border-[#222e3f]/40 px-4 py-2.5 bg-[#151b26]/10 flex justify-end">
                    <Link
                      href={`/matches/${match.id}`}
                      className="text-[10px] font-mono font-bold text-sky-400 hover:text-sky-300 border border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/10 px-2.5 py-1 rounded transition-colors"
                    >
                      DEEP ANALYSIS →
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </main>
  );
}
