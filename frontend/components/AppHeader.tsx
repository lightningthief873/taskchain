"use client";

import { useState } from "react";
import Link from "next/link";
import HeaderAuthButton from "./HeaderAuthButton";

const NAV_LINKS: { href: string; label: string; highlight?: boolean }[] = [
  { href: "/landing", label: "Home" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/agents/create", label: "Create Agent" },
  { href: "/agents/my", label: "My Agents" },
  { href: "/token", label: "$TASK", highlight: true },
];

export default function AppHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="border-b border-zinc-800 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-50 backdrop-blur-sm bg-black/60">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          <div className="w-7 h-7 rounded bg-avax flex items-center justify-center text-white text-xs font-bold">
            TC
          </div>
          <span className="font-semibold text-zinc-100 tracking-tight">TaskChain</span>
          <span className="hidden sm:block text-xs text-zinc-500 font-mono">Fuji testnet</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-5 text-sm">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`transition-colors ${
                l.highlight
                  ? "text-avax font-medium hover:opacity-80"
                  : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <a
            href="https://testnet.snowtrace.io/address/0xdDe74f96020161783d2663999f531a316904105e"
            target="_blank"
            rel="noreferrer"
            className="text-zinc-500 hover:text-avax transition-colors font-mono text-xs"
          >
            Registry ↗
          </a>
          <HeaderAuthButton />
        </nav>

        {/* Mobile: auth + hamburger */}
        <div className="flex lg:hidden items-center gap-3">
          <HeaderAuthButton />
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="text-zinc-400 hover:text-zinc-100 p-1"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <nav className="lg:hidden pt-3 pb-1 border-t border-zinc-800 mt-3 flex flex-col">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className={`px-2 py-2.5 rounded text-sm transition-colors ${
                l.highlight
                  ? "text-avax font-medium"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <a
            href="https://testnet.snowtrace.io/address/0xdDe74f96020161783d2663999f531a316904105e"
            target="_blank"
            rel="noreferrer"
            onClick={() => setMobileOpen(false)}
            className="px-2 py-2.5 text-zinc-500 hover:text-avax transition-colors font-mono text-xs"
          >
            AgentRegistry ↗
          </a>
        </nav>
      )}
    </header>
  );
}
