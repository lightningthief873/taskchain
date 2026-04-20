# TaskChain

TaskChain is an autonomous multi-agent task economy running on Avalanche Fuji, where a router agent decomposes plain-English tasks, hires specialist AI micro-agents from an on-chain marketplace via x402 HTTP payments (USDC), and delivers the composed result — no human approval required at any step. Every agent has an on-chain identity and reputation score stored in an ERC-8004 registry, so the router always selects the highest-reputation agent for each subtask. Payments settle on-chain in real time using EIP-3009 `transferWithAuthorization`, making the entire economy verifiable on the Fuji explorer.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Avalanche Fuji C-Chain                          │
│              AgentRegistry (ERC-8004 reputation + identity)         │
│         0xdDe74f96020161783d2663999f531a316904105e                   │
└──────────────┬──────────────────────────────────┬───────────────────┘
               │ registerAgent / recordCompletion  │ getReputation
               ▼                                   ▼
  ┌────────────────────────┐          ┌───────────────────────────┐
  │  Frontend  :3010       │          │  x402 Facilitator  :4021  │
  │  Next.js 16 App Router │          │  verifies + settles USDC  │
  │  ┌──────────────────┐  │          │  on Fuji via EIP-3009     │
  │  │ Task Input       │  │          └────────────┬──────────────┘
  │  │ /page.tsx        │  │                       │ settle tx
  │  ├──────────────────┤  │                       │
  │  │ Dashboard        │  │                       │
  │  │ /dashboard       │  │                       │
  │  └──────────────────┘  │                       │
  └───────────┬────────────┘                       │
              │ POST /task                          │
              ▼                                     │
  ┌───────────────────────┐    402 + payment        │
  │  Router Agent  :3000  │◄────────────────────────┘
  │  ┌─────────────────┐  │
  │  │ decomposer.ts   │  │  1. Calls Anthropic to break task into steps
  │  │ selector.ts     │  │  2. Queries AgentRegistry for best reputation
  │  │ executor.ts     │  │  3. Pays each agent 0.01 USDC via x402-axios
  │  └─────────────────┘  │
  └──┬─────────┬──────────┘
     │ 0.01    │ 0.01 USDC each (EIP-3009 signed)
     USDC      │
     ▼         ▼
  ┌──────┐  ┌──────┐  ┌────────────┐
  │:3002 │  │:3003 │  │   :3001    │
  │Anlyz │  │Write │  │ Translator │
  │stats │  │prose │  │  Spanish   │
  └──────┘  └──────┘  └────────────┘
   x402 paywall on every POST /execute endpoint
```

**Payment flow per agent call:**
```
Router → POST /execute → 402 { paymentRequired }
      ← sign EIP-3009 USDC authorization
      → POST /execute + X-PAYMENT header
      → Facilitator.verify()  →  Facilitator.settle() → on-chain USDC transfer
      → Agent processes task → returns result
      → Agent calls AgentRegistry.recordCompletion() → reputation updated
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Avalanche Fuji C-Chain (chainId 43113) |
| Smart Contracts | Solidity 0.8.24, Hardhat, ethers.js v6 |
| On-chain Identity | ERC-8004 AgentRegistry |
| Payments | x402 protocol v2 (`@x402/express`, `@x402/axios`, `@x402/evm`) |
| Stablecoin | USDC on Fuji (`0x5425890298aed601595a70AB815c96711a31Bc65`) |
| Payment Auth | EIP-3009 `transferWithAuthorization` (gasless USDC transfer) |
| AI Services | Anthropic Claude `claude-sonnet-4-20250514` |
| Backend | Node.js 20, TypeScript strict, Express |
| Frontend | Next.js 16, Tailwind CSS, ethers.js v6 |
| Infra | Docker Compose |

---

## Quickstart (Docker — recommended)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Testnet wallets funded (see [Wallet Funding](#wallet-funding))
- Anthropic API key (or use mock mode — see [Mock Mode](#mock-mode))

### 5 Steps

**Step 1 — Clone the repo**
```bash
git clone https://github.com/lightningthief873/taskchain.git
cd taskchain
```

**Step 2 — Configure environment**
```bash
cp .env.example .env
```
Fill in `.env` with your private keys and API key. See [Wallet Funding](#wallet-funding) if starting fresh. The AgentRegistry is already deployed — no need to redeploy.

**Step 3 — Start the stack**
```bash
docker compose up --build
```
This builds all images and starts: facilitator → analyzer, writer, translator → router → frontend. Health checks ensure services start in the correct order. First build takes ~3–5 minutes. Wait for:
```
taskchain-frontend  | ▲ Next.js 16 ready on port 3010
```

**Step 4 — Open the app**

Navigate to **http://localhost:3010**

**Step 5 — Run a task**

The task form is pre-filled. Click **Run Pipeline →** and watch:
- Router decomposes the task
- Analyzer gets paid 0.01 USDC, returns statistics
- Writer gets paid 0.01 USDC, returns a prose summary
- Translator gets paid 0.01 USDC, returns the Spanish translation
- Dashboard at `/dashboard` shows live on-chain payment events

---

## Manual Setup (without Docker)

```bash
# Install dependencies
npm install

# Copy and fill environment
cp .env.example .env

# Terminal 1 — local x402 facilitator
npx ts-node x402/facilitator.ts

# Terminal 2 — analyzer agent (port 3002)
npx ts-node agents/analyzer/index.ts

# Terminal 3 — writer agent (port 3003)
npx ts-node agents/writer/index.ts

# Terminal 4 — translator agent (port 3001)
npx ts-node agents/translator/index.ts

# Terminal 5 — router agent (port 3000)
npx ts-node agents/router/index.ts

# Terminal 6 — frontend (port 3010)
cd frontend && npm install && npm run dev

# Terminal 7 — run the test script (optional)
npx ts-node scripts/test-full-flow.ts
```

> **Note:** Use absolute paths for `npx ts-node` to avoid working-directory issues on Windows:
> ```bash
> TDIR="$(pwd)" npx ts-node "$TDIR/agents/analyzer/index.ts"
> ```

---

## Wallet Funding

Generate fresh wallets (skip if already in `.env`):
```bash
npx ts-node scripts/generate-wallets.ts
```

| Wallet | Needs | Faucet |
|---|---|---|
| `DEPLOYER` | Test AVAX (gas) | [faucet.avax.network](https://faucet.avax.network/) |
| `ROUTER_AGENT` | Test USDC (payments) | [faucet.circle.com](https://faucet.circle.com/) → Avalanche Fuji |
| `TRANSLATOR_AGENT` | Test AVAX (gas for `recordCompletion`) | [faucet.avax.network](https://faucet.avax.network/) |
| `ANALYZER_AGENT` | Test AVAX (gas for `recordCompletion`) | [faucet.avax.network](https://faucet.avax.network/) |
| `WRITER_AGENT` | Test AVAX (gas for `recordCompletion`) | [faucet.avax.network](https://faucet.avax.network/) |

---

## Mock Mode

If you don't have Anthropic API credits, set these flags in `.env` to test the full x402 payment pipeline with hardcoded responses:

```env
MOCK_DECOMPOSITION=true   # Router uses a static 3-step plan
MOCK_ANALYSIS=true        # Analyzer returns pre-computed stats
MOCK_WRITING=true         # Writer returns a hardcoded paragraph
MOCK_TRANSLATION=true     # Translator returns hardcoded Spanish
```

Remove these flags (or set to `false`) when you have API credits loaded. The x402 payment flow, on-chain settlements, and reputation updates all work identically in both modes.

---

## Deploying a New Contract (optional)

The AgentRegistry is already deployed. Only do this if you want your own instance:

```bash
# Compile contracts
npx hardhat compile

# Deploy to Fuji (updates AGENT_REGISTRY_ADDRESS in .env)
npx ts-node scripts/deploy.ts

# Register all agents on-chain
npx ts-node scripts/register-agents.ts
```

---

## On-Chain Addresses (Fuji Testnet)

| Contract | Address | Explorer |
|---|---|---|
| AgentRegistry | `0xdDe74f96020161783d2663999f531a316904105e` | [snowtrace ↗](https://testnet.snowtrace.io/address/0xdDe74f96020161783d2663999f531a316904105e) |
| USDC (Fuji) | `0x5425890298aed601595a70AB815c96711a31Bc65` | [snowtrace ↗](https://testnet.snowtrace.io/address/0x5425890298aed601595a70AB815c96711a31Bc65) |

| Agent | Address | Reputation |
|---|---|---|
| Translator | `0x106927178B6a28efFF6fad138443E3d898fe2Ac8` | score=100 |
| Analyzer | `0xADa0D502dD3d51B3A0f1E26d8C6826Bb7D456BeF` | score=50 |
| Writer | `0xEeA0d97AEe6d8eCFCEb69De9479e15C3ee843840` | score=50 |

---

## Agent API Reference

Every agent exposes the same interface:

### `POST /execute`
Payment-gated. Requires a valid x402 `X-PAYMENT` header (handled automatically by `@x402/axios`).

**Translator** — `POST http://localhost:3001/execute`
```json
// Request
{ "text": "Hello world" }

// Response
{ "taskId": "0x...", "originalText": "Hello world", "translatedText": "Hola mundo", "language": "es" }
```

**Analyzer** — `POST http://localhost:3002/execute`
```json
// Request
{ "data": [1, 2, 3, 4, 5] }

// Response
{ "taskId": "0x...", "stats": { "min": 1, "max": 5, "mean": 3, "median": 3, "sum": 15, "count": 5 } }
```

**Writer** — `POST http://localhost:3003/execute`
```json
// Request
{ "analysis": { "min": 1, "max": 5, "mean": 3, "sum": 15, "count": 5 } }

// Response
{ "taskId": "0x...", "summary": "The dataset contains 5 values..." }
```

**Router** — `POST http://localhost:3000/task`
```json
// Request
{ "description": "Analyze [1,2,3,4,5], write a summary, translate to Spanish", "payload": { "data": [1,2,3,4,5] } }

// Response
{ "taskId": "0x...", "steps": [...], "finalResult": { "translatedText": "..." } }
```

### `GET /health`
Returns `{ "status": "ok", "agent": "...", "address": "0x...", "price": "0.01 USDC" }`.

---

## Adding a New Agent

1. Copy `agents/translator/index.ts` as a template
2. Set a new port (e.g., `SUMMARIZER_PORT=3004`)
3. Generate a wallet: add to `scripts/generate-wallets.ts`, run it
4. Add it to `agents/router/selector.ts` agent registry map
5. Add the agentType case to `agents/router/executor.ts` `buildAgentPayload`
6. Add it to `scripts/register-agents.ts` and run to register on-chain
7. Add health check to `docker-compose.yml`

---

## Monetization Guide

TaskChain is production-ready infrastructure for a real AI micro-payment economy. Here's how to turn it into a business:

### 1. Run Your Own Agent Marketplace
Deploy the stack to a public server (Railway, Render, AWS, GCP). Set your own prices in `shared/config.ts`:
```typescript
export const TRANSLATION_PRICE_RAW = "50000"; // raise to 0.05 USDC
```
Users pay you in USDC — no gas required on their end, no card processing, instant settlement.

### 2. Build Specialized Agents
Add domain-specific agents behind the x402 paywall:
- **Legal Agent** — contract review, clause extraction
- **Medical Agent** — symptom analysis, medication lookup (non-diagnostic)
- **Financial Agent** — stock data analysis, ratio calculation
- **Code Agent** — bug detection, refactoring suggestions
- **Image Agent** — description, OCR, alt-text generation

Each agent is a ~100-line Express server. Deploy it anywhere, register its address on-chain, and it can be hired by any router.

### 3. Upgrade to Mainnet
The stack is designed for Avalanche C-Chain mainnet with no code changes:
- Change `FUJI_RPC_URL` to a mainnet RPC
- Update `USDC_CONTRACT_ADDRESS` to mainnet USDC
- Deploy `AgentRegistry` to mainnet
- Point `PAYMENT_FACILITATOR_URL` to a mainnet facilitator

### 4. Add Task Escrow (TaskEscrow.sol)
`contracts/TaskEscrow.sol` is ready to deploy. It holds payment until the task is validated by the router, then releases it — giving clients confidence they pay only for verified results.

### 5. Multi-Router Marketplace
Any developer can run a router and route tasks to the public agent registry. Agents earn reputation passively. Higher-reputation agents can charge more. This creates a self-regulating marketplace.

### 6. API-as-a-Service
Expose the router as a hosted API (with your own API key auth layer). Charge customers per-task. Collect the spread between what you charge and what agents cost.

---

## Replicating This Project

To fork and run your own version:

1. Fork this repo
2. Run `npx ts-node scripts/generate-wallets.ts` — generates 5 fresh wallets
3. Fund wallets (see [Wallet Funding](#wallet-funding))
4. Run `npx ts-node scripts/deploy.ts` — deploys a fresh AgentRegistry
5. Run `npx ts-node scripts/register-agents.ts` — registers your agents on-chain
6. `docker compose up --build` — full stack online

The only contract address you own is your `AGENT_REGISTRY_ADDRESS`. Everything else is permissionless — your router can hire agents from anyone's registry, and vice versa.

---

## Hackathon Requirements Checklist

- [x] Deployed on Avalanche C-Chain (Fuji testnet)
- [x] x402 protocol for HTTP-native stablecoin payments
- [x] ERC-8004 for on-chain agent identity and reputation
- [x] Payments triggered programmatically, settled instantly on Fuji
- [x] 3 on-chain payment settlements per task run (confirmed tx hashes in CLAUDE.md)
- [x] Frontend with live payment visualization
- [x] Docker Compose one-command deployment
- [x] Full TypeScript, strict mode, 0 type errors

---

## License

MIT — fork freely, deploy commercially, build your agent empire.
