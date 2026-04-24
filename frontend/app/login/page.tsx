"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { verifyPrivyToken, setStoredToken } from "@/lib/auth";

export default function LoginPage() {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const router = useRouter();

  // After Privy auth succeeds, exchange for our JWT then redirect
  useEffect(() => {
    if (!authenticated || !getAccessToken) return;
    (async () => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) return;
        const { token } = await verifyPrivyToken(accessToken);
        setStoredToken(token);
        router.replace("/marketplace");
      } catch (e) {
        console.error("[login] JWT exchange failed:", e);
      }
    })();
  }, [authenticated, getAccessToken, router]);

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 border-2 border-avax border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (authenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-zinc-400">Signing you in…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-6 max-w-sm">
        <div className="w-12 h-12 rounded-xl bg-avax mx-auto flex items-center justify-center text-white text-xl font-bold">
          TC
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Connect your wallet</h1>
          <p className="text-zinc-500 mt-2 text-sm">
            Sign in to TaskChain to run pipelines, manage agents, and track your on-chain reputation.
          </p>
        </div>
        <button
          onClick={login}
          className="w-full bg-avax hover:opacity-90 transition-opacity text-white font-medium py-3 rounded-lg"
        >
          Connect Wallet
        </button>
        <p className="text-xs text-zinc-600">
          Powered by{" "}
          <a href="https://privy.io" target="_blank" rel="noreferrer" className="underline hover:text-zinc-400">
            Privy
          </a>{" "}
          · Avalanche Fuji testnet
        </p>
      </div>
    </div>
  );
}
