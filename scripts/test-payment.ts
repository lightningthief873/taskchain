/**
 * Phase 1 integration test:
 * 1. Sends POST /execute to the translator agent
 * 2. x402-axios intercepts the 402, signs & sends 0.01 USDC from router wallet
 * 3. Logs the translation response
 * 4. Logs the tx hash for Fuji explorer verification
 */
import axios from "axios";
import { wrapAxiosWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/axios";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";
import { TRANSLATOR_PORT, FUJI_NETWORK } from "../shared/config";

dotenv.config();

const ROUTER_KEY = process.env.ROUTER_AGENT_PRIVATE_KEY as `0x${string}`;
if (!ROUTER_KEY) throw new Error("ROUTER_AGENT_PRIVATE_KEY not set in .env");

async function main() {
  const account = privateKeyToAccount(ROUTER_KEY);
  console.log(`\nRouter wallet: ${account.address}`);

  // Create an axios instance that automatically handles x402 payment challenges
  const api = wrapAxiosWithPaymentFromConfig(axios.create(), {
    schemes: [
      {
        network: FUJI_NETWORK,     // eip155:43113 — Fuji
        client: new ExactEvmScheme(account),
      },
    ],
  });

  const url = `http://localhost:${TRANSLATOR_PORT}/execute`;
  const payload = {
    text: "Hello, this is a test of the TaskChain payment system on Avalanche Fuji.",
  };

  console.log(`\nPOST ${url}`);
  console.log("Body:", payload);
  console.log("\nWaiting for 402 → payment → response...\n");

  try {
    const response = await api.post(url, payload);
    const data = response.data as {
      taskId: string;
      originalText: string;
      translatedText: string;
      language: string;
      model: string;
    };

    console.log("=== PAYMENT SUCCESSFUL ===\n");
    console.log(`Task ID:         ${data.taskId}`);
    console.log(`Original:        ${data.originalText}`);
    console.log(`Translation (ES): ${data.translatedText}`);
    console.log(`Model:           ${data.model}`);

    // Decode payment details
    const paymentRespHeader = response.headers["x-payment-response"] as string | undefined;
    if (paymentRespHeader) {
      try {
        const paymentDetails = decodePaymentResponseHeader(paymentRespHeader);
        console.log("\n=== PAYMENT DETAILS ===");
        console.log(JSON.stringify(paymentDetails, null, 2));

        // Extract tx hash if present
        const txHash = (paymentDetails as Record<string, unknown>).txHash
          || (paymentDetails as Record<string, unknown>).transactionHash;
        if (txHash) {
          console.log(`\nFuji Explorer: https://testnet.snowtrace.io/tx/${txHash}`);
        }
      } catch {
        console.log("\nPayment response header (raw):", paymentRespHeader);
      }
    }

    console.log("\n=== TEST PASSED ===");
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error("\nRequest failed:", err.response?.status, err.response?.data || err.message);
    } else {
      console.error("\nError:", err instanceof Error ? err.message : err);
    }
    process.exit(1);
  }
}

main();
