"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { verifyPrivyToken, setStoredToken, clearStoredToken, getStoredToken } from "@/lib/auth";

function truncate(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function resolveAddress(user: ReturnType<typeof usePrivy>["user"]): string | undefined {
  if (!user) return undefined;
  // user.wallet covers both embedded and external wallets in Privy v3
  if (user.wallet?.address) return user.wallet.address;
  // Fallback: scan linkedAccounts for any wallet entry
  const linked = user.linkedAccounts?.find(
    (a) => a.type === "wallet" || (a as { walletClientType?: string }).walletClientType,
  ) as { address?: string } | undefined;
  return linked?.address;
}

export default function ConnectWalletButton() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const [username, setUsername] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authenticated || !getAccessToken) return;
    (async () => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) return;
        const { token, user: profile } = await verifyPrivyToken(accessToken);
        setStoredToken(token);
        setUsername(profile.username);
        // Notify other components on the same page that the token is ready
        window.dispatchEvent(new CustomEvent("tc_token_ready", { detail: token }));
      } catch (e) {
        console.error("[auth] verify failed:", e);
      }
    })();
  }, [authenticated, getAccessToken]);

  if (!ready) {
    return <div className="h-8 w-32 animate-pulse rounded bg-zinc-800" />;
  }

  const walletAddress = resolveAddress(user);

  function copyAddress() {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (authenticated && walletAddress) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={copyAddress}
          title="Click to copy full address"
          className="text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          {username ? (
            <span className="text-avax font-semibold mr-1">{username}</span>
          ) : null}
          {copied ? "Copied!" : truncate(walletAddress)}
        </button>
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
