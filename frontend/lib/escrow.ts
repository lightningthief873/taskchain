/**
 * Frontend helpers for interacting with SatisfactionEscrow on Fuji.
 *
 * Requires window.ethereum or a Privy embedded wallet provider.
 * All amounts in raw USDC micro-units (6 decimals).
 */
import { ethers } from "ethers";

export const USDC_ADDRESS = "0x5425890298aed601595a70AB815c96711a31Bc65";

const USDC_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
];

const ESCROW_ABI = [
  "function fundTask(bytes32 taskId, address[] calldata agents, uint256[] calldata amounts, uint256 total) external",
  "function approveTask(bytes32 taskId) external",
  "function disputeTask(bytes32 taskId, string calldata reason) external",
  "function getEscrow(bytes32 taskId) view returns (address user, uint256 total, uint8 status, uint256 deadline, address paymentToken)",
];

export function taskId32(taskId: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(taskId));
}

export async function getBrowserSigner(
  eip1193Provider?: ethers.Eip1193Provider,
): Promise<ethers.JsonRpcSigner> {
  const prov =
    eip1193Provider ??
    (typeof window !== "undefined" ? (window as unknown as { ethereum?: ethers.Eip1193Provider }).ethereum : undefined);
  if (!prov) {
    throw new Error(
      "No wallet provider found. Use MetaMask or connect with an embedded wallet.",
    );
  }
  const provider = new ethers.BrowserProvider(prov);
  return provider.getSigner();
}

export async function approveUSDC(
  signer: ethers.JsonRpcSigner,
  escrowAddress: string,
  amount: bigint,
): Promise<ethers.TransactionReceipt | null> {
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
  const tx = await (usdc.approve(escrowAddress, amount) as Promise<ethers.TransactionResponse>);
  return tx.wait();
}

export async function fundEscrow(
  signer: ethers.JsonRpcSigner,
  escrowAddress: string,
  taskId: string,
  agentAddresses: string[],
  agentAmounts: number[],
  totalAmount: number,
): Promise<{ receipt: ethers.TransactionReceipt | null; txHash: string }> {
  const escrow = new ethers.Contract(escrowAddress, ESCROW_ABI, signer);
  const id32 = taskId32(taskId);
  const amounts = agentAmounts.map((a) => BigInt(a));
  const total = BigInt(totalAmount);

  const tx = await (escrow.fundTask(
    id32,
    agentAddresses,
    amounts,
    total,
  ) as Promise<ethers.TransactionResponse>);
  const receipt = await tx.wait();
  return { receipt, txHash: tx.hash };
}

export async function approveEscrowTask(
  signer: ethers.JsonRpcSigner,
  escrowAddress: string,
  taskId: string,
): Promise<{ receipt: ethers.TransactionReceipt | null; txHash: string }> {
  const escrow = new ethers.Contract(escrowAddress, ESCROW_ABI, signer);
  const id32 = taskId32(taskId);
  const tx = await (escrow.approveTask(id32) as Promise<ethers.TransactionResponse>);
  const receipt = await tx.wait();
  return { receipt, txHash: tx.hash };
}

export async function disputeEscrowTask(
  signer: ethers.JsonRpcSigner,
  escrowAddress: string,
  taskId: string,
  reason: string,
): Promise<{ receipt: ethers.TransactionReceipt | null; txHash: string }> {
  const escrow = new ethers.Contract(escrowAddress, ESCROW_ABI, signer);
  const id32 = taskId32(taskId);
  const tx = await (escrow.disputeTask(id32, reason) as Promise<ethers.TransactionResponse>);
  const receipt = await tx.wait();
  return { receipt, txHash: tx.hash };
}

export async function getEscrowState(
  escrowAddress: string,
  taskId: string,
): Promise<{ user: string; total: bigint; status: number; deadline: bigint } | null> {
  if (!escrowAddress) return null;
  try {
    const provider = new ethers.JsonRpcProvider(
      process.env.NEXT_PUBLIC_FUJI_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc",
    );
    const escrow = new ethers.Contract(escrowAddress, ESCROW_ABI, provider);
    const [user, total, status, deadline] = (await escrow.getEscrow(taskId32(taskId))) as [string, bigint, number, bigint];
    return { user, total, status, deadline };
  } catch {
    return null;
  }
}
