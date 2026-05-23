"use client";

import React, { useState } from "react";
import { Activity, Clock, Search } from "lucide-react";
import Link from "next/link";
import Panel from "../components/Panel";

interface Match {
  id: string;
  league: string;
  startsAt: string;
  homeTeam: string;
  awayTeam: string;
  status: "SCHEDULED" | "LIVE" | "FINAL";
  odds: {
    bookmaker: string;
    homePrice: number; // american
    awayPrice: number; // american
  }[];
  modelEdge: {
    selection: string;
    edgePct: number;
  };
  clvPct?: number;
}

const mockMatches: Match[] = [
  {
    id: "m-1",
    league: "NBA",
    startsAt: "2026-05-23T00:30:00Z",
    homeTeam: "Boston Celtics",
    awayTeam: "Miami Heat",
    status: "LIVE",
    odds: [
      { bookmaker: "Pinnacle", homePrice: -180, awayPrice: 155 },
      { bookmaker: "DraftKings", homePrice: -185, awayPrice: 150 },
      { bookmaker: "Circa", homePrice: -178, awayPrice: 158 }
    ],
    modelEdge: { selection: "Miami Heat", edgePct: 4.8 },
    clvPct: 1.2
  },
  {
    id: "m-2",
    league: "EPL",
    startsAt: "2026-05-23T14:00:00Z",
    homeTeam: "Manchester City",
    awayTeam: "Arsenal",
    status: "SCHEDULED",
    odds: [
      { bookmaker: "Pinnacle", homePrice: 110, awayPrice: 240 },
      { bookmaker: "DraftKings", homePrice: 105, awayPrice: 245 }
    ],
    modelEdge: { selection: "Manchester City", edgePct: 3.2 }
  },
  {
    id: "m-3",
    league: "MLB",
    startsAt: "2026-05-23T18:10:00Z",
    homeTeam: "New York Yankees",
    awayTeam: "Boston Red Sox",
    status: "SCHEDULED",
    odds: [
      { bookmaker: "Pinnacle", homePrice: -130, awayPrice: 110 },
      { bookmaker: "Circa", homePrice: -128, awayPrice: 112 }
    ],
    modelEdge: { selection: "New York Yankees", edgePct: 1.5 }
  },
  {
    id: "m-4",
    league: "NBA",
    startsAt: "2026-05-23T02:00:00Z",
    homeTeam: "Denver Nuggets",
    awayTeam: "Phoenix Suns",
    status: "SCHEDULED",
    odds: [
      { bookmaker: "Pinnacle", homePrice: -220, awayPrice: 185 },
      { bookmaker: "DraftKings", homePrice: -225, awayPrice: 180 }
    ],
    modelEdge: { selection: "Phoenix Suns", edgePct: -1.2 }
  },
  {
    id: "m-5",
    league: "EPL",
    startsAt: "2026-05-22T19:00:00Z",
    homeTeam: "Liverpool",
    awayTeam: "Chelsea",
    status: "FINAL",
    odds: [
      { bookmaker: "Pinnacle", homePrice: -140, awayPrice: 320 }
    ],
    modelEdge: { selection: "Liverpool", edgePct: 0.8 },
    clvPct: 2.1
  }
];

export default function MatchesPage() {
  const [selectedLeague, setSelectedLeague] = useState<string>("ALL");
  const leagues = ["ALL", "NBA", "EPL", "MLB"];

  const filteredMatches = mockMatches.filter(
    (m) => selectedLeague === "ALL" || m.league === selectedLeague
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

        {/* Filter Controls */}
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

      {/* Matches Grid/List */}
      <div className="space-y-4">
        {filteredMatches.map((match) => {
          const isLive = match.status === "LIVE";
          const isFinal = match.status === "FINAL";

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
                    {match.league}
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
                      SCHEDULED
                    </span>
                  )}
                </div>
              </div>

              {/* Card Middle Row */}
              <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                {/* Team Names */}
                <div className="lg:col-span-5 flex flex-col gap-1">
                  <div className="flex items-center justify-between sm:justify-start gap-4">
                    <span className="text-sm font-semibold text-slate-200">{match.homeTeam}</span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">HOME</span>
                  </div>
                  <div className="flex items-center justify-between sm:justify-start gap-4">
                    <span className="text-sm font-semibold text-slate-200">{match.awayTeam}</span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">AWAY</span>
                  </div>
                </div>

                {/* Bookmaker Odds Columns */}
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {match.odds.map((o, idx) => (
                    <div
                      key={idx}
                      className="border border-[#222e3f]/40 bg-[#151b26]/30 rounded p-2 text-center flex flex-col justify-between"
                    >
                      <span className="text-[9px] font-bold font-mono text-slate-500 tracking-wider uppercase border-b border-[#222e3f]/20 pb-1 mb-1.5">
                        {o.bookmaker}
                      </span>
                      <div className="flex justify-around items-center text-xs font-mono">
                        <div className="flex flex-col">
                          <span className="text-[8px] text-slate-500">H</span>
                          <span className="font-semibold text-slate-300">
                            {o.homePrice > 0 ? `+${o.homePrice}` : o.homePrice}
                          </span>
                        </div>
                        <span className="text-slate-600">|</span>
                        <div className="flex flex-col">
                          <span className="text-[8px] text-slate-500">A</span>
                          <span className="font-semibold text-slate-300">
                            {o.awayPrice > 0 ? `+${o.awayPrice}` : o.awayPrice}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Fill empty spots for alignment consistency */}
                  {match.odds.length < 3 && (
                    <div className="border border-[#222e3f]/20 border-dashed rounded p-2 flex items-center justify-center text-[10px] text-slate-600 font-mono">
                      [NO OTHER COMMITTED LINES]
                    </div>
                  )}
                </div>
              </div>

              {/* Card Bottom Row */}
              <div className="border-t border-[#222e3f]/40 px-4 py-2.5 bg-[#151b26]/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">MODEL INSIGHT:</span>
                  {match.modelEdge.edgePct > 0 ? (
                    <span className="text-xs font-mono text-emerald-400">
                      Edge on <span className="font-semibold">{match.modelEdge.selection}</span> (+{match.modelEdge.edgePct}%)
                    </span>
                  ) : (
                    <span className="text-xs font-mono text-slate-500">
                      No positive edge detected (Best selection: {match.modelEdge.selection} @ {match.modelEdge.edgePct}%)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {match.clvPct !== undefined && (
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-[10px] text-slate-500 uppercase">CLV MOVE:</span>
                      <span className="text-emerald-500">+{match.clvPct.toFixed(2)}%</span>
                    </div>
                  )}
                  <Link
                    href={`/matches/${match.id}`}
                    className="text-[10px] font-mono font-bold text-sky-400 hover:text-sky-300 border border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/10 px-2.5 py-1 rounded transition-colors"
                  >
                    DEEP ANALYSIS →
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
