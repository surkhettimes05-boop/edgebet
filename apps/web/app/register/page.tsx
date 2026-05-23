import React from "react";
import LoginForm from "../components/auth/LoginForm";

export const metadata = {
  title: "Register // EdgeBet",
  description: "Create your EdgeBet analytical platform account."
};

export default function RegisterPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500 animate-pulse-subtle" />
            <span className="font-mono text-base font-bold tracking-widest text-slate-100">
              EDGEBET // CONTROL
            </span>
          </div>
          <h1 className="text-xl font-semibold font-mono text-slate-100 tracking-tight">
            CREATE ACCOUNT
          </h1>
          <p className="text-xs text-slate-500 font-mono">
            Set up your analytical platform access.
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#10141d] border border-[#222e3f] rounded-lg p-6 space-y-6">
          <LoginForm mode="register" />
        </div>

        {/* Footer note */}
        <p className="text-center text-[10px] text-slate-600 font-mono">
          EDGEBET IS AN ANALYTICAL TOOL. NOT A GAMBLING SERVICE.
        </p>
      </div>
    </main>
  );
}
