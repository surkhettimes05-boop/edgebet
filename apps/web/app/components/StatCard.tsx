import React from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down" | "flat";
  trendValue?: string;
}

export default function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue
}: StatCardProps) {
  return (
    <div className="rounded border border-[#222e3f] bg-[#10141d] p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 font-mono">
          {label}
        </p>
        {Icon && <Icon className="h-4 w-4 text-slate-500" />}
      </div>
      
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight text-slate-100 font-mono">
          {value}
        </span>
        {trend && trendValue && (
          <span
            className={`text-xs font-mono font-medium ${
              trend === "up"
                ? "text-emerald-500"
                : trend === "down"
                ? "text-rose-500"
                : "text-slate-400"
            }`}
          >
            {trend === "up" ? "▲" : trend === "down" ? "▼" : "■"} {trendValue}
          </span>
        )}
      </div>

      {subtitle && (
        <span className="mt-1 text-[11px] text-slate-500 leading-none">
          {subtitle}
        </span>
      )}
    </div>
  );
}
