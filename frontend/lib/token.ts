/**
 * Frontend helpers for TASK token and TaskStaking contract interactions.
 * Requires window.ethereum (MetaMask / Privy embedded wallet).
 */
import { ethers } from "ethers";
import { getBrowserSigner } from "./escrow";

export const TASK_TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_TASK_TOKEN_ADDRESS ?? "";
export const TASK_STAKING_ADDRESS =
  process.env.NEXT_PUBLIC_TASK_STAKING_ADDRESS ?? "";

const FUJI_RPC =
  process.env.NEXT_PUBLIC_FUJI_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc";

const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const STAKING_ABI = [
  "function stake(uint256 amount) external",
  "function unstake(uint256 amount) external",
  "function claimRewards() external",
  "function getStake(address user) view returns (uint256)",
  "function earned(address user) view returns (uint256)",
  "function stakes(address user) view returns (uint256 amount, uint256 lockedUntil)",
  "function totalStaked() view returns (uint256)",
  "function minStakeVerified() view returns (uint256)",
];

function readProvider() {
  return new ethers.JsonRpcProvider(FUJI_RPC);
}

export interface TokenStats {
  totalSupply: bigint;
  yourBalance: bigint;
  stakedAmount: bigint;
  lockedUntil: bigint;
  claimableRewards: bigint;
  totalStaked: bigint;
  minStakeVerified: bigint;
}

export async function getTokenStats(userAddress: string): Promise<TokenStats> {
  const provider = readProvider();
  const token = new ethers.Contract(TASK_TOKEN_ADDRESS, TOKEN_ABI, provider);
  const staking = new ethers.Contract(TASK_STAKING_ADDRESS, STAKING_ABI, provider);

  const [totalSupply, yourBalance, stakeInfo, claimableRewards, totalStaked, minStakeVerified] =
    await Promise.all([
      token.totalSupply() as Promise<bigint>,
      token.balanceOf(userAddress) as Promise<bigint>,
      staking.stakes(userAddress) as Promise<[bigint, bigint]>,
      staking.earned(userAddress) as Promise<bigint>,
      staking.totalStaked() as Promise<bigint>,
      staking.minStakeVerified() as Promise<bigint>,
    ]);

  const [stakedAmount, lockedUntil] = stakeInfo;
  return { totalSupply, yourBalance, stakedAmount, lockedUntil, claimableRewards, totalStaked, minStakeVerified };
}

export async function approveTaskToken(
  spender: string,
  amount: bigint,
  eip1193Provider?: ethers.Eip1193Provider,
): Promise<ethers.TransactionReceipt | null> {
  const signer = await getBrowserSigner(eip1193Provider);
  const token = new ethers.Contract(TASK_TOKEN_ADDRESS, TOKEN_ABI, signer);
  const tx = await (token.approve(spender, amount) as Promise<ethers.TransactionResponse>);
  return tx.wait();
}

export async function stakeTask(
  amount: bigint,
  eip1193Provider?: ethers.Eip1193Provider,
): Promise<{ receipt: ethers.TransactionReceipt | null; txHash: string }> {
  const signer = await getBrowserSigner(eip1193Provider);
  const staking = new ethers.Contract(TASK_STAKING_ADDRESS, STAKING_ABI, signer);
  const tx = await (staking.stake(amount) as Promise<ethers.TransactionResponse>);
  const receipt = await tx.wait();
  return { receipt, txHash: tx.hash };
}

export async function unstakeTask(
  amount: bigint,
  eip1193Provider?: ethers.Eip1193Provider,
): Promise<{ receipt: ethers.TransactionReceipt | null; txHash: string }> {
  const signer = await getBrowserSigner(eip1193Provider);
  const staking = new ethers.Contract(TASK_STAKING_ADDRESS, STAKING_ABI, signer);
  const tx = await (staking.unstake(amount) as Promise<ethers.TransactionResponse>);
  const receipt = await tx.wait();
  return { receipt, txHash: tx.hash };
}

export async function claimStakingRewards(
  eip1193Provider?: ethers.Eip1193Provider,
): Promise<{ receipt: ethers.TransactionReceipt | null; txHash: string }> {
  const signer = await getBrowserSigner(eip1193Provider);
  const staking = new ethers.Contract(TASK_STAKING_ADDRESS, STAKING_ABI, signer);
  const tx = await (staking.claimRewards() as Promise<ethers.TransactionResponse>);
  const receipt = await tx.wait();
  return { receipt, txHash: tx.hash };
}

export function formatTask(raw: bigint): string {
  return parseFloat(ethers.formatUnits(raw, 18)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}
