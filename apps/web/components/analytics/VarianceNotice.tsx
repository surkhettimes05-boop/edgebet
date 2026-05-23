import React from "react";
import { Info } from "lucide-react";

export interface VarianceEvaluation {
  shouldDisplay: boolean;
  code: string | null;
  severity: "info" | null;
  message: string | null;
  reasons?: Record<string, boolean>;
}

interface VarianceNoticeProps {
  evaluation: VarianceEvaluation;
}

export default function VarianceNotice({ evaluation }: VarianceNoticeProps) {
  if (!evaluation.shouldDisplay || !evaluation.message) {
    return null;
  }

  return (
    <div
      className="rounded border border-sky-500/30 bg-sky-500/5 border-l-4 border-l-sky-500 p-3 flex gap-3 text-xs"
      data-variance-code={evaluation.code ?? undefined}
      role="status"
    >
      <Info className="h-4.5 w-4.5 shrink-0 text-sky-400" />
      <div className="flex flex-col gap-0.5">
        {evaluation.message.split("\n").map((line) => (
          <span key={line} className="font-semibold text-slate-200 leading-normal">
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}
