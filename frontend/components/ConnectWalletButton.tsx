"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { verifyPrivyToken, setStoredToken, clearStoredToken, getStoredToken } from "@/lib/auth";

function truncate(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export default function ConnectWalletButton() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated || !getAccessToken) return;
    (async () => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) return;
        const { token, user: profile } = await verifyPrivyToken(accessToken);
        setStoredToken(token);
        setUsername(profile.username);
      } catch (e) {
        console.error("[auth] verify failed:", e);
      }
    })();
  }, [authenticated, getAccessToken]);

  if (!ready) {
    return <div className="h-8 w-32 animate-pulse rounded bg-zinc-800" />;
  }

  const walletAddress = user?.wallet?.address ?? user?.linkedAccounts?.find((a) => a.type === "wallet")?.address;

  if (authenticated && walletAddress) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-zinc-400">
          {username ? (
            <span className="text-avax font-semibold mr-1">{username}</span>
          ) : null}
          {truncate(walletAddress)}
        </span>
        <button
          onClick={() => { logout(); clearStoredToken(); setUsername(null); }}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors border border-zinc-700 px-2 py-1 rounded"
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (authenticated) {
    return (
      <button
        onClick={() => { logout(); clearStoredToken(); }}
        className="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 px-3 py-1.5 rounded transition-colors"
      >
        Disconnect
      </button>
    );
  }

  return (
    <button
      onClick={login}
      className="text-sm font-medium bg-avax hover:opacity-90 transition-opacity text-white px-4 py-1.5 rounded"
    >
      Connect Wallet
    </button>
  );
}

// Fallback when Privy is not configured (NEXT_PUBLIC_PRIVY_APP_ID not set)
export function ConnectWalletButtonFallback() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => setToken(getStoredToken()), []);

  if (token) {
    return (
      <button
        onClick={() => { clearStoredToken(); setToken(null); }}
        className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 px-2 py-1 rounded"
      >
        Disconnect
      </button>
    );
  }
  return (
    <span className="text-xs text-zinc-500 italic">Privy not configured</span>
  );
}
