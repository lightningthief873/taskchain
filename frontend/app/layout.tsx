import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import PrivyProviderWrapper from "@/components/PrivyProviderWrapper";
import HeaderAuthButton from "@/components/HeaderAuthButton";

export const metadata: Metadata = {
  title: "TaskChain — Autonomous Multi-Agent Economy on Avalanche",
  description: "Autonomous task orchestration with x402 payments and ERC-8004 reputation on Fuji",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen" style={{ background: "var(--bg)" }}>
        <PrivyProviderWrapper>
          <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-sm bg-black/60">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-7 h-7 rounded bg-avax flex items-center justify-center text-white text-xs font-bold">
                TC
              </div>
              <span className="font-semibold text-zinc-100 tracking-tight">TaskChain</span>
              <span className="text-xs text-zinc-500 font-mono">Fuji testnet</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/" className="text-zinc-400 hover:text-zinc-100 transition-colors">
                Run Task
              </Link>
              <Link href="/marketplace" className="text-zinc-400 hover:text-zinc-100 transition-colors">
                Marketplace
              </Link>
              <Link href="/dashboard" className="text-zinc-400 hover:text-zinc-100 transition-colors">
                Dashboard
              </Link>
              <Link href="/agents/create" className="text-zinc-400 hover:text-zinc-100 transition-colors">
                Create Agent
              </Link>
              <Link href="/agents/my" className="text-zinc-400 hover:text-zinc-100 transition-colors">
                My Agents
              </Link>
              <a
                href="https://testnet.snowtrace.io/address/0xdDe74f96020161783d2663999f531a316904105e"
                target="_blank"
                rel="noreferrer"
                className="text-zinc-500 hover:text-avax transition-colors font-mono text-xs"
              >
                AgentRegistry ↗
              </a>
              <HeaderAuthButton />
            </nav>
          </header>
          <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
        </PrivyProviderWrapper>
      </body>
    </html>
  );
}
