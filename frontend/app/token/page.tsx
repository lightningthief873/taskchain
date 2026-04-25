"use client";

import { useEffect, useState, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import {
  getTokenStats,
  approveTaskToken,
  stakeTask,
  unstakeTask,
  claimStakingRewards,
  formatTask,
  TASK_STAKING_ADDRESS,
  type TokenStats,
} from "@/lib/token";

// ── Helpers ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="text-xl font-bold text-zinc-100">{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function TxLink({ hash }: { hash: string }) {
  return (
    <a
      href={`https://testnet.snowtrace.io/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-avax underline truncate"
    >
      {hash.slice(0, 18)}…
    </a>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TokenPage() {
  const { user, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const walletAddress = (user?.wallet?.address ?? "").toLowerCase();

  async function getEip1193(): Promise<ethers.Eip1193Provider> {
    const privyWallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
    if (privyWallet) {
      await privyWallet.switchChain(43113); // ensure Fuji testnet
      return (await privyWallet.getEthereumProvider()) as ethers.Eip1193Provider;
    }
    const win = typeof window !== "undefined" ? (window as unknown as { ethereum?: ethers.Eip1193Provider }) : {};
    if (win.ethereum) return win.ethereum;
    throw new Error("No wallet provider found. Connect a wallet first.");
  }

  const [stats, setStats] = useState<TokenStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stakeInput, setStakeInput] = useState("");
  const [unstakeInput, setUnstakeInput] = useState("");
  const [txBusy, setTxBusy] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    setError(null);
    try {
      setStats(await getTokenStats(walletAddress));
    } catch {
      setError("Failed to load on-chain stats — check that NEXT_PUBLIC_TASK_TOKEN_ADDRESS is set.");
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => { void loadStats(); }, [loadStats]);

  async function handleStake() {
    if (!stakeInput || isNaN(parseFloat(stakeInput))) return;
    setTxBusy(true);
    try {
      const eip1193 = await getEip1193();
      const amount = ethers.parseUnits(stakeInput, 18);
      await approveTaskToken(TASK_STAKING_ADDRESS, amount, eip1193);
      const { txHash } = await stakeTask(amount, eip1193);
      setLastTx(txHash);
      setStakeInput("");
      await loadStats();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Stake failed");
    } finally {
      setTxBusy(false);
    }
  }

  async function handleUnstake() {
    if (!unstakeInput || isNaN(parseFloat(unstakeInput))) return;
    setTxBusy(true);
    try {
      const eip1193 = await getEip1193();
      const amount = ethers.parseUnits(unstakeInput, 18);
      const { txHash } = await unstakeTask(amount, eip1193);
      setLastTx(txHash);
      setUnstakeInput("");
      await loadStats();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Unstake failed");
    } finally {
      setTxBusy(false);
    }
  }

  async function handleClaim() {
    setTxBusy(true);
    try {
      const eip1193 = await getEip1193();
      const { txHash } = await claimStakingRewards(eip1193);
      setLastTx(txHash);
      await loadStats();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setTxBusy(false);
    }
  }

  const lockedUntilDate =
    stats && stats.lockedUntil > BigInt(0)
      ? new Date(Number(stats.lockedUntil) * 1000).toLocaleDateString()
      : null;

  const isLocked =
    stats && stats.lockedUntil > BigInt(0)
      ? BigInt(Math.floor(Date.now() / 1000)) < stats.lockedUntil
      : false;

  const minStakeDisplay = stats ? formatTask(stats.minStakeVerified) : "1,000";
  const hasEnoughToVerify = stats ? stats.stakedAmount >= (stats.minStakeVerified) : false;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">$TASK Token</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Stake TASK to list Verified Agents, earn treasury rewards, and get fee discounts.
        </p>
      </div>

      {!authenticated ? (
        <div className="border border-zinc-800 rounded-lg p-8 text-center">
          <p className="text-zinc-400 mb-4">Connect your wallet to view your TASK balance and stake.</p>
          <button
            onClick={() => void login()}
            className="px-5 py-2 bg-avax text-white rounded font-medium hover:opacity-90"
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        <>
          {/* ── Stats ── */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-20 rounded-lg bg-zinc-900 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="border border-red-900/40 bg-red-950/20 rounded-lg p-4 text-red-400 text-sm">
              {error}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatCard
                label="Total Supply"
                value={formatTask(stats.totalSupply) + " TASK"}
              />
              <StatCard
                label="Total Staked"
                value={formatTask(stats.totalStaked) + " TASK"}
              />
              <StatCard
                label="Your Balance"
                value={formatTask(stats.yourBalance) + " TASK"}
              />
              <StatCard
                label="Your Staked"
                value={formatTask(stats.stakedAmount) + " TASK"}
                sub={
                  isLocked
                    ? `Locked until ${lockedUntilDate}`
                    : stats.stakedAmount > BigInt(0)
                    ? "Unlocked — can unstake"
                    : undefined
                }
              />
              <StatCard
                label="Claimable Rewards"
                value={formatTask(stats.claimableRewards) + " TASK"}
                sub="50% of platform treasury fees"
              />
              <StatCard
                label="Verified Agent Threshold"
                value={minStakeDisplay + " TASK"}
                sub={hasEnoughToVerify ? "✓ You qualify" : "Stake more to qualify"}
              />
            </div>
          ) : null}

          {/* ── Actions ── */}
          <div className="grid sm:grid-cols-2 gap-6">
            {/* Stake */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5 space-y-3">
              <h2 className="font-semibold text-zinc-100">Stake TASK</h2>
              <p className="text-xs text-zinc-500">
                Tokens lock for 7 days. Stake {minStakeDisplay}+ to qualify as a Verified Agent owner.
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={stakeInput}
                  onChange={(e) => setStakeInput(e.target.value)}
                  placeholder="Amount"
                  className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-avax"
                />
                <button
                  onClick={() => void handleStake()}
                  disabled={txBusy || !stakeInput}
                  className="px-4 py-2 bg-avax text-white rounded text-sm font-medium disabled:opacity-50"
                >
                  {txBusy ? "…" : "Stake"}
                </button>
              </div>
            </div>

            {/* Unstake */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5 space-y-3">
              <h2 className="font-semibold text-zinc-100">Unstake TASK</h2>
              <p className="text-xs text-zinc-500">
                {isLocked
                  ? `Tokens locked until ${lockedUntilDate}.`
                  : "No active lockup — you can unstake freely."}
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={unstakeInput}
                  onChange={(e) => setUnstakeInput(e.target.value)}
                  placeholder="Amount"
                  className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-avax"
                />
                <button
                  onClick={() => void handleUnstake()}
                  disabled={txBusy || !unstakeInput || !!isLocked}
                  className="px-4 py-2 bg-zinc-700 text-white rounded text-sm font-medium disabled:opacity-50"
                >
                  {txBusy ? "…" : "Unstake"}
                </button>
              </div>
            </div>
          </div>

          {/* Claim Rewards */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-zinc-100">Claim Staking Rewards</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {stats
                  ? `${formatTask(stats.claimableRewards)} TASK available to claim`
                  : "—"}
              </p>
            </div>
            <button
              onClick={() => void handleClaim()}
              disabled={txBusy || !stats || stats.claimableRewards === BigInt(0)}
              className="px-5 py-2 bg-emerald-700 text-white rounded text-sm font-medium disabled:opacity-50 shrink-0"
            >
              {txBusy ? "…" : "Claim Rewards"}
            </button>
          </div>

          {lastTx && (
            <div className="text-xs text-zinc-500 flex items-center gap-2">
              Last tx: <TxLink hash={lastTx} />
            </div>
          )}

          {/* ── How to get TASK ── */}
          <div className="border border-zinc-800 rounded-lg p-6 space-y-4">
            <h2 className="font-semibold text-zinc-100">How to Get $TASK</h2>
            <div className="space-y-3 text-sm text-zinc-400">
              <div className="flex gap-3">
                <span className="text-avax font-bold shrink-0">Demo</span>
                <span>
                  Run <code className="bg-zinc-800 px-1 rounded text-zinc-200">npx ts-node scripts/distribute-tokens.ts</code> to airdrop
                  1,000 TASK to 10 test wallets for hackathon demos.
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-avax font-bold shrink-0">Earn</span>
                <span>
                  Agent owners earn TASK from fees proportional to their agent's task volume.
                  Rewards are deposited weekly into the staking contract.
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-avax font-bold shrink-0">Referral</span>
                <span>
                  Invite other agent builders and earn 2% of their first month's fees in TASK.
                  (Coming in Phase 10.)
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-avax font-bold shrink-0">Airdrop</span>
                <span>
                  Early users (first 500 wallets that run a task) will receive a one-time TASK
                  airdrop at mainnet launch.
                </span>
              </div>
            </div>
          </div>

          {/* ── Token Allocation ── */}
          <div className="border border-zinc-800 rounded-lg p-6 space-y-4">
            <h2 className="font-semibold text-zinc-100">Token Allocation</h2>
            <p className="text-xs text-zinc-500">Total supply: 100,000,000 TASK</p>
            <div className="space-y-2">
              {[
                { label: "Community Rewards", pct: 40, note: "agent earnings, usage mining" },
                { label: "Team", pct: 20, note: "3-year vesting, 1-year cliff" },
                { label: "Ecosystem Fund", pct: 15, note: "grants, integrations" },
                { label: "Public Sale / Liquidity", pct: 15, note: "" },
                { label: "Early Backers", pct: 10, note: "2-year vesting" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3 text-sm">
                  <div className="w-32 text-zinc-300 shrink-0">{row.label}</div>
                  <div className="flex-1 bg-zinc-800 rounded-full h-2">
                    <div
                      className="bg-avax h-2 rounded-full"
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  <div className="w-10 text-right text-zinc-400 shrink-0">{row.pct}%</div>
                  {row.note && (
                    <div className="text-xs text-zinc-600 shrink-0 hidden sm:block">{row.note}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
