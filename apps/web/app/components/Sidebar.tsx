"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  TrendingUp,
  ClipboardList,
  Menu,
  X,
  Radio,
  LogOut,
  User
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Matches", href: "/matches", icon: Calendar },
    { name: "Value Bets", href: "/value-bets", icon: TrendingUp },
    { name: "Bet Tracker", href: "/bet-tracker", icon: ClipboardList }
  ];

  return (
    <>
      {/* Mobile Top Header */}
      <header className="lg:hidden h-14 border-b border-[#222e3f] bg-[#0c0f16] flex items-center justify-between px-4 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse-subtle" />
          <span className="font-mono text-sm font-bold tracking-widest text-slate-200">
            EDGEBET // SYSTEM
          </span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-slate-400 hover:text-slate-200 focus:outline-none"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Overlay for Mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-14 lg:top-0 bottom-0 left-0 w-60 bg-[#0c0f16] border-r border-[#222e3f] z-30 transition-transform lg:transition-none lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo - Hidden on Mobile since we have the top header */}
          <div className="hidden lg:flex items-center gap-2.5 px-6 h-16 border-b border-[#222e3f] bg-[#080a0f]">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500 animate-pulse-subtle" />
            <span className="font-mono text-base font-bold tracking-widest text-slate-100">
              EDGEBET // CONTROL
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 text-xs font-mono tracking-wider transition-all duration-150 rounded border ${
                    isActive
                      ? "bg-[#151b26] border-l-2 border-l-sky-500 border-[#222e3f] text-sky-400 font-bold"
                      : "text-slate-500 border-transparent hover:text-slate-300 hover:bg-[#10141d]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.name.toUpperCase()}
                </Link>
              );
            })}
          </nav>

          {/* User + Status Footer */}
          <div className="p-4 border-t border-[#222e3f] bg-[#080a0f] text-[10px] font-mono text-slate-500 flex flex-col gap-1.5">
            {user && (
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-slate-400 truncate">
                  <User className="h-3 w-3 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  aria-label="Sign out"
                  className="text-slate-500 hover:text-rose-400 transition-colors ml-2 shrink-0"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span>SYSTEM STATUS:</span>
              <span className="text-emerald-500 flex items-center gap-1 font-bold">
                <Radio className="h-3 w-3 animate-pulse-subtle" /> ONLINE
              </span>
            </div>
            <div>API: {process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}</div>
            <div>VER: 0.1.0-BETA</div>
          </div>
        </div>
      </aside>
    </>
  );
}
