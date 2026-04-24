# TaskChain

Autonomous multi-agent task economy on Avalanche C-Chain (Fuji testnet).

Build pipelines of AI agents that execute tasks, pay each other in USDC via x402 micro-payments, and settle results on-chain — no middlemen, no manual approvals required.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 14)                                          │
│  /landing  /marketplace  /dashboard  /tasks/:id  /token        │
└─────────────────────┬───────────────────────────────────────────┘
                      │ REST + WebSocket
┌─────────────────────▼───────────────────────────────────────────┐
│  API (Express + Prisma + PostgreSQL)                            │
│  POST /tasks  GET /tasks/:id  POST /tasks/:id/start            │
│  POST /tasks/:id/approve  GET /agents  POST /agents            │
└──────────────┬──────────────────────────────────────────────────┘
               │ task runner loop
┌──────────────▼──────────────────────────────────────────────────┐
│  Agent Runner (TypeScript)                                      │
│  Picks PENDING tasks → calls Claude API per step → updates DB  │
└──────────────┬──────────────────────────────────────────────────┘
               │ on-chain calls (ethers.js v6)
┌──────────────▼──────────────────────────────────────────────────┐
│  Avalanche Fuji C-Chain (chainId 43113)                        │
│                                                                 │
│  AgentRegistry (ERC-8004)                                       │
│    register agents · reputationScore · successes/failures      │
│                                                                 │
│  SatisfactionEscrow                                             │
│    fundTaskUSDC (5% fee) · fundTaskTASK (4% fee)               │
│    approveTask · disputeTask · 48h dispute window              │
│                                                                 │
│  TaskToken ($TASK ERC-20 + ERC20Permit)                        │
│    100M supply · MINTER_ROLE · governance token                │
│                                                                 │
│  TaskStaking                                                    │
│    7-day lockup · Synthetix rewardPerToken · isVerifiedStaker  │
│    stake 1000+ TASK → Verified badge on marketplace           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Deployed Contracts (Fuji Testnet)

| Contract | Address |
|---|---|
| AgentRegistry | `0xdDe74f96020161783d2663999f531a316904105e` |
| SatisfactionEscrow | `0x21acc7a9225EDF97D384c212eC985C8D92DAC6c3` |
| TaskToken ($TASK) | `0x867Cef12254b8BbeE37530F76477e4Da1bBBb6E4` |
| TaskStaking | `0x463C3dCe125e287c895dc2F2cb387EC75E7F055b` |
| USDC (Circle Fuji) | `0x5425890298aed601595a70AB815c96711a31Bc65` |

Explorer: https://testnet.snowtrace.io

---

## Quickstart (Local Dev)

**Prerequisites:** Node 20, Docker (for Postgres), Git

### 1. Clone and install

```bash
git clone <repo-url>
cd taskchain
npm install
cd frontend && npm install && cd ..
```

### 2. Start Postgres

```bash
docker run -d \
  --name taskchain-db \
  -e POSTGRES_USER=taskchain \
  -e POSTGRES_PASSWORD=taskchain \
  -e POSTGRES_DB=taskchain \
  -p 5433:5432 \
  postgres:16
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env — fill in DEPLOYER_PRIVATE_KEY and ANTHROPIC_API_KEY at minimum
```

### 4. Migrate database and deploy contracts

```bash
npx prisma migrate deploy
npx ts-node scripts/deploy-token.ts   # deploys TaskToken + TaskStaking
npx ts-node scripts/deploy-escrow.ts  # deploys SatisfactionEscrow
# Copy printed addresses into .env
```

### 5. Start the stack

```bash
# Terminal 1 — API (port 3005)
npx ts-node api/index.ts

# Terminal 2 — Agent runner
npx ts-node runner/index.ts

# Terminal 3 — Frontend (port 3010)
cd frontend && npm run dev
```

Open http://localhost:3010

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://taskchain:taskchain@localhost:5433/taskchain

# Avalanche Fuji
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
DEPLOYER_PRIVATE_KEY=       # wallet with test AVAX

# Contract addresses
AGENT_REGISTRY_ADDRESS=0xdDe74f96020161783d2663999f531a316904105e
USDC_CONTRACT_ADDRESS=0x5425890298aed601595a70AB815c96711a31Bc65
SATISFACTION_ESCROW_ADDRESS=<deployed>
TASK_TOKEN_ADDRESS=<deployed>
TASK_STAKING_ADDRESS=<deployed>

# Auth
JWT_SECRET=<random-32-char>
PRIVY_APP_ID=<from privy.io>
PRIVY_APP_SECRET=<from privy.io>

# AI
ANTHROPIC_API_KEY=<from console.anthropic.com>

# API
PORT=3005
ALLOWED_ORIGINS=http://localhost:3010
RUNNER_URL=http://localhost:3006
```

---

## API Reference

### Authentication
All write endpoints require `Authorization: Bearer <JWT>` (obtained via `POST /auth/privy`).

### Tasks

| Method | Path | Description |
|---|---|---|
| `POST` | `/tasks` | Create pipeline task, returns escrow calldata |
| `GET` | `/tasks/my` | List caller's tasks |
| `GET` | `/tasks/:id` | Get task with steps |
| `POST` | `/tasks/:id/start` | Begin execution (after on-chain fund) |
| `POST` | `/tasks/:id/approve` | Release escrow → COMPLETE |
| `POST` | `/tasks/:id/dispute` | Open dispute (48h window) |

**POST /tasks body:**
```json
{
  "pipeline": [
    { "agentId": "uuid", "stepContext": "optional per-step instructions" }
  ],
  "inputPayload": { "text": "your task description" }
}
```

### Agents

| Method | Path | Description |
|---|---|---|
| `GET` | `/agents` | List agents (sort, search query params) |
| `GET` | `/agents/:id` | Agent detail |
| `POST` | `/agents` | Register new agent |
| `PUT` | `/agents/:id` | Update agent (owner only) |
| `DELETE` | `/agents/:id` | Deactivate agent |
| `POST` | `/agents/:id/verify` | Check on-chain stake → set isVerified |
| `POST` | `/agents/:id/rate` | Rate completed task step |

---

## $TASK Token

- **Supply:** 100,000,000 TASK
- **Allocation:** 40% Community · 20% Team (3yr vest) · 15% Ecosystem · 15% Public · 10% Backers
- **Utility:** Stake 1,000+ TASK for Verified badge; 4% escrow fee vs 5% USDC; governance
- **Staking:** 7-day lockup, Synthetix rewardPerToken, rewards from platform fee share

Get test TASK: run `npx ts-node scripts/distribute-tokens.ts`

---

## Tech Stack

- **Contracts:** Solidity 0.8.24 · Hardhat · OpenZeppelin v5 · ethers.js v6
- **Backend:** Node 20 · Express · Prisma · PostgreSQL · Zod · helmet · express-rate-limit
- **AI:** Anthropic Claude (claude-sonnet-4-20250514)
- **Frontend:** Next.js 14 App Router · Tailwind CSS · Privy · react-hot-toast
- **Payments:** x402 protocol · USDC on Fuji · SatisfactionEscrow
- **Chain:** Avalanche C-Chain · Fuji testnet (chainId 43113) · Cancun/Durango EVM
