"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoginFormProps {
  mode: "login" | "register";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoginForm({ mode }: LoginFormProps) {
  const { login, register } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === "register";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Basic client-side validation
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isRegister) {
        await register(email.trim(), password, name.trim() || undefined);
      } else {
        await login(email.trim(), password);
      }
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Name field — register only */}
      {isRegister && (
        <div className="space-y-1.5">
          <label
            htmlFor="name"
            className="block text-[11px] font-mono font-bold uppercase tracking-widest text-slate-400"
          >
            Display Name <span className="text-slate-600 normal-case tracking-normal font-normal">(optional)</span>
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex"
            className="w-full bg-[#080a0f] border border-[#222e3f] rounded px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-colors"
          />
        </div>
      )}

      {/* Email */}
      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-[11px] font-mono font-bold uppercase tracking-widest text-slate-400"
        >
          Email Address
        </label>
        <input
          id="email"
          type="email"
          autoComplete={isRegister ? "email" : "username"}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="analyst@example.com"
          className="w-full bg-[#080a0f] border border-[#222e3f] rounded px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-colors"
        />
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-[11px] font-mono font-bold uppercase tracking-widest text-slate-400"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isRegister ? "Min. 8 characters" : "••••••••"}
            className="w-full bg-[#080a0f] border border-[#222e3f] rounded px-3 py-2.5 pr-10 text-sm text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/30 rounded px-3 py-2.5 text-xs text-rose-400 font-mono"
        >
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-900 disabled:text-sky-600 disabled:cursor-not-allowed text-white font-mono font-bold text-xs uppercase tracking-widest py-2.5 rounded transition-colors"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {isRegister ? "CREATING ACCOUNT..." : "AUTHENTICATING..."}
          </>
        ) : (
          isRegister ? "CREATE ACCOUNT" : "SIGN IN"
        )}
      </button>

      {/* Toggle link */}
      <p className="text-center text-[11px] text-slate-500 font-mono">
        {isRegister ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-sky-400 hover:text-sky-300 transition-colors">
              Sign in
            </Link>
          </>
        ) : (
          <>
            No account yet?{" "}
            <Link href="/register" className="text-sky-400 hover:text-sky-300 transition-colors">
              Register
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
