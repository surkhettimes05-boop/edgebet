import React from "react";

interface PanelProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export default function Panel({ title, children, className = "", action }: PanelProps) {
  return (
    <div className={`rounded border border-[#222e3f] bg-[#10141d] flex flex-col overflow-hidden ${className}`}>
      <div className="border-b border-[#222e3f] px-4 py-2.5 flex items-center justify-between bg-[#0c0f16]">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 font-mono">
          {title}
        </h2>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      <div className="p-4 flex-1">
        {children}
      </div>
    </div>
  );
}
