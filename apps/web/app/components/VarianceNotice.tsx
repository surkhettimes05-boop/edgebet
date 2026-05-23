import React from "react";
import { Info, AlertTriangle, ShieldAlert } from "lucide-react";

interface VarianceNoticeProps {
  type: "info" | "warning" | "caution";
  message: string;
  detail?: string;
}

export default function VarianceNotice({ type, message, detail }: VarianceNoticeProps) {
  const styles = {
    info: {
      border: "border-sky-500/30",
      bg: "bg-sky-500/5",
      text: "text-sky-400",
      borderLeft: "border-l-sky-500",
      icon: Info
    },
    warning: {
      border: "border-amber-500/30",
      bg: "bg-amber-500/5",
      text: "text-amber-400",
      borderLeft: "border-l-amber-500",
      icon: AlertTriangle
    },
    caution: {
      border: "border-rose-500/30",
      bg: "bg-rose-500/5",
      text: "text-rose-400",
      borderLeft: "border-l-rose-500",
      icon: ShieldAlert
    }
  };

  const config = styles[type];
  const Icon = config.icon;

  return (
    <div
      className={`rounded border ${config.border} ${config.bg} border-l-4 ${config.borderLeft} p-3 flex gap-3 text-xs`}
    >
      <Icon className={`h-4.5 w-4.5 shrink-0 ${config.text}`} />
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-slate-200">{message}</span>
        {detail && <span className="text-slate-400 leading-normal">{detail}</span>}
      </div>
    </div>
  );
}
