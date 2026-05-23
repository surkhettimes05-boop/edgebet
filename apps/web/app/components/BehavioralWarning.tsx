import React from "react";

interface BehavioralWarningSignal {
  type: string;
  severity: number; // 1 = LOW/INFO, 2 = MEDIUM/WARNING, 3 = HIGH/CRITICAL
  message: string;
  detail?: string;
}

interface BehavioralWarningProps {
  signals: BehavioralWarningSignal[];
}

export default function BehavioralWarning({ signals }: BehavioralWarningProps) {
  if (!signals || signals.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded border border-[#222e3f] bg-[#151b26]/50 px-3 py-3 text-xs text-slate-500 font-mono">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-subtle" />
        No behavioral anomalies detected. System operating within baseline.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {signals.map((signal, index) => {
        const severityColor =
          signal.severity === 3
            ? "bg-rose-500"
            : signal.severity === 2
            ? "bg-amber-500"
            : "bg-slate-500";

        const severityBorder =
          signal.severity === 3
            ? "border-rose-500/20"
            : signal.severity === 2
            ? "border-amber-500/20"
            : "border-slate-800";

        return (
          <div
            key={index}
            className={`flex items-start gap-3 rounded border ${severityBorder} bg-[#151b26] p-3 text-xs`}
          >
            <div className="mt-1 flex shrink-0">
              <span className={`h-2 w-2 rounded-full ${severityColor}`} />
            </div>
            <div className="flex flex-col gap-0.5 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold tracking-wider uppercase text-slate-300">
                  [{signal.type}]
                </span>
              </div>
              <span className="text-slate-200">{signal.message}</span>
              {signal.detail && (
                <span className="text-slate-400 font-mono mt-1 text-[10px]">
                  {signal.detail}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
