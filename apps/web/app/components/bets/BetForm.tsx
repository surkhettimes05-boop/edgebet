"use client";

import React, { useEffect, useState } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BetFormValues {
  matchDescription: string;
  leagueName: string;
  market: string;
  selection: string;
  stakeUnits: string;
  priceDecimal: string;
  bookmakerName: string;
  modelFairProbability: string;
  placedAt: string;
}

export interface BetFormProps {
  mode: "create" | "edit";
  initialValues?: Partial<BetFormValues>;
  onSubmit: (values: BetFormValues) => Promise<void>;
  onClose: () => void;
}

const MARKETS = ["MONEYLINE", "SPREAD", "TOTAL", "PLAYER_PROP", "BTTS"];

const EMPTY: BetFormValues = {
  matchDescription: "",
  leagueName: "",
  market: "MONEYLINE",
  selection: "",
  stakeUnits: "",
  priceDecimal: "",
  bookmakerName: "",
  modelFairProbability: "",
  placedAt: ""
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function BetForm({ mode, initialValues, onSubmit, onClose }: BetFormProps) {
  const [values, setValues] = useState<BetFormValues>({ ...EMPTY, ...initialValues });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync initialValues when switching between edit targets
  useEffect(() => {
    setValues({ ...EMPTY, ...initialValues });
    setError(null);
  }, [initialValues]);

  function set(field: keyof BetFormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  // Live EV preview
  const evPreview = (() => {
    const prob = parseFloat(values.modelFairProbability);
    const odds = parseFloat(values.priceDecimal);
    if (!isNaN(prob) && prob > 0 && prob < 1 && !isNaN(odds) && odds > 1) {
      return ((prob * odds - 1) * 100).toFixed(2);
    }
    return null;
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!values.matchDescription.trim()) {
      setError("Match description is required.");
      return;
    }
    if (!values.selection.trim()) {
      setError("Selection is required.");
      return;
    }
    const stake = parseFloat(values.stakeUnits);
    if (isNaN(stake) || stake <= 0) {
      setError("Stake must be a positive number.");
      return;
    }
    const odds = parseFloat(values.priceDecimal);
    if (isNaN(odds) || odds <= 1) {
      setError("Decimal odds must be greater than 1.0 (e.g. 1.91, 2.50).");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "create" ? "Log new bet" : "Edit bet"}
    >
      <div className="w-full max-w-lg bg-[#10141d] border border-[#222e3f] rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#222e3f] bg-[#0c0f16]">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-300">
            {mode === "create" ? "LOG NEW BET" : "EDIT BET"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-500 hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="p-5 space-y-4 overflow-y-auto max-h-[80vh]">
          {/* Match + League row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="field-label">Match <span className="text-rose-500">*</span></label>
              <input
                type="text"
                value={values.matchDescription}
                onChange={(e) => set("matchDescription", e.target.value)}
                placeholder="e.g. Celtics vs Heat"
                className="field-input"
              />
            </div>
            <div className="space-y-1.5">
              <label className="field-label">League / Competition</label>
              <input
                type="text"
                value={values.leagueName}
                onChange={(e) => set("leagueName", e.target.value)}
                placeholder="e.g. NBA, EPL"
                className="field-input"
              />
            </div>
            <div className="space-y-1.5">
              <label className="field-label">Bookmaker</label>
              <input
                type="text"
                value={values.bookmakerName}
                onChange={(e) => set("bookmakerName", e.target.value)}
                placeholder="e.g. Pinnacle"
                className="field-input"
              />
            </div>
          </div>

          {/* Market + Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="field-label">Market <span className="text-rose-500">*</span></label>
              <select
                value={values.market}
                onChange={(e) => set("market", e.target.value)}
                className="field-input"
              >
                {MARKETS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="field-label">Selection <span className="text-rose-500">*</span></label>
              <input
                type="text"
                value={values.selection}
                onChange={(e) => set("selection", e.target.value)}
                placeholder="e.g. Heat ML, Over 224.5"
                className="field-input"
              />
            </div>
          </div>

          {/* Stake + Odds */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="field-label">Stake (units) <span className="text-rose-500">*</span></label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={values.stakeUnits}
                onChange={(e) => set("stakeUnits", e.target.value)}
                placeholder="e.g. 1.00"
                className="field-input"
              />
            </div>
            <div className="space-y-1.5">
              <label className="field-label">
                Entry Odds (decimal) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="1.01"
                value={values.priceDecimal}
                onChange={(e) => set("priceDecimal", e.target.value)}
                placeholder="e.g. 2.10"
                className="field-input"
              />
            </div>
          </div>

          {/* Model probability + EV preview */}
          <div className="space-y-1.5">
            <label className="field-label">
              Model Fair Probability{" "}
              <span className="text-slate-600 normal-case tracking-normal font-normal">(0–1, optional)</span>
            </label>
            <div className="flex gap-3 items-center">
              <input
                type="number"
                step="0.001"
                min="0.001"
                max="0.999"
                value={values.modelFairProbability}
                onChange={(e) => set("modelFairProbability", e.target.value)}
                placeholder="e.g. 0.52"
                className="field-input flex-1"
              />
              {evPreview !== null && (
                <div
                  className={`shrink-0 text-xs font-mono font-bold px-3 py-2 rounded border ${
                    parseFloat(evPreview) > 0
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                  }`}
                >
                  EV: {parseFloat(evPreview) > 0 ? "+" : ""}{evPreview}%
                </div>
              )}
            </div>
          </div>

          {/* Placed at */}
          <div className="space-y-1.5">
            <label className="field-label">
              Placed At{" "}
              <span className="text-slate-600 normal-case tracking-normal font-normal">(optional)</span>
            </label>
            <input
              type="datetime-local"
              value={values.placedAt}
              onChange={(e) => set("placedAt", e.target.value)}
              className="field-input"
            />
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/30 rounded px-3 py-2.5 text-xs text-rose-400 font-mono"
            >
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-mono font-bold uppercase tracking-widest text-slate-400 border border-[#222e3f] rounded hover:border-slate-600 hover:text-slate-200 transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-mono font-bold uppercase tracking-widest bg-sky-600 hover:bg-sky-500 disabled:bg-sky-900 disabled:text-sky-700 text-white rounded transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  SAVING...
                </>
              ) : mode === "create" ? "LOG BET" : "SAVE CHANGES"}
            </button>
          </div>
        </form>
      </div>

      {/* Shared field styles via inline Tailwind — injected via className strings above */}
      <style>{`
        .field-label {
          display: block;
          font-size: 11px;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #94a3b8;
        }
        .field-input {
          width: 100%;
          background: #080a0f;
          border: 1px solid #222e3f;
          border-radius: 4px;
          padding: 8px 12px;
          font-size: 13px;
          font-family: 'JetBrains Mono', monospace;
          color: #e2e8f0;
          outline: none;
          transition: border-color 0.15s;
        }
        .field-input::placeholder { color: #475569; }
        .field-input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 2px rgba(14,165,233,0.15); }
        .field-input option { background: #10141d; }
      `}</style>
    </div>
  );
}
