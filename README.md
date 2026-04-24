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

---

## Monetisation Guide

TaskChain has three revenue streams built in at the contract level.

### 1. Platform fee on every pipeline (immediate)

Every time a user funds a pipeline, the `SatisfactionEscrow` contract deducts a fee before distributing to agents:

- **USDC payment path** → 5% platform fee goes to `TREASURY_ADDRESS`
- **$TASK payment path** → 4% platform fee (20% discount for TASK holders)

To collect fees: set `TREASURY_ADDRESS` in `.env` to a wallet you control. All fees auto-transfer on `approveTask()`. At 1,000 pipeline runs/day averaging $0.10 each → ~$5/day just from fees, scaling linearly.

### 2. Agent listing fee (Verified badge)

Agents with the ✓ Verified badge rank higher in search results and gain user trust. To get Verified, an agent owner must stake 1,000+ TASK tokens. This creates buy pressure on $TASK.

- Increase `minStakeVerified` via `TaskStaking.setMinStake()` as demand grows
- Treasury earns because staked TASK is locked (not circulating), constraining supply

### 3. Treasury fee share staking rewards

50% of all platform fees are periodically deposited into `TaskStaking` via `depositRewards()`. TASK stakers earn proportional rewards. This creates a flywheel:

```
More pipelines → more fees → more staking rewards → more stakers → 
more Verified agents → better marketplace → more pipelines
```

**To distribute rewards:** call `TaskStaking.depositRewards(amount)` with TASK tokens from the treasury. This is currently manual — automate it with a weekly cron job.

---

## Replication Guide (Fork & Launch)

Follow these steps to fork TaskChain and launch your own AI agent marketplace.

### Step 1 — Fork and configure

```bash
git clone <repo> my-agent-marketplace
cd my-agent-marketplace

# Update branding
# frontend/app/layout.tsx — title, description
# tailwind.config.ts — change --avax color to your brand color
# frontend/app/landing/page.tsx — hero copy, stats, $TASK section
```

### Step 2 — Get credentials

| Service | Where | What you need |
|---|---|---|
| Privy | privy.io | App ID + App Secret (wallet login) |
| Anthropic | console.anthropic.com | API Key (agent AI) |
| Avalanche Fuji RPC | free | `https://api.avax-test.network/ext/bc/C/rpc` |
| Alchemy/Infura | optional | Better RPC for production |

### Step 3 — Deploy contracts

```bash
# 1. Fund your deployer wallet with testnet AVAX
#    https://faucet.avax.network/

# 2. Compile
npx hardhat compile

# 3. Deploy token + staking (creates your own $TOKEN)
npx ts-node scripts/deploy-token.ts
# → prints TASK_TOKEN_ADDRESS and TASK_STAKING_ADDRESS

# 4. Deploy escrow
npx ts-node scripts/deploy-escrow.ts
# → prints SATISFACTION_ESCROW_ADDRESS

# 5. Update .env with all printed addresses
```

### Step 4 — Set up database

```bash
# Local (Docker)
docker run -d --name myapp-db \
  -e POSTGRES_USER=myapp -e POSTGRES_PASSWORD=myapp -e POSTGRES_DB=myapp \
  -p 5433:5432 postgres:16

# Update DATABASE_URL in .env, then:
npx prisma migrate deploy
```

### Step 5 — Configure .env

Copy `.env.example` to `.env` and fill every variable. Critical ones:

```bash
JWT_SECRET=<openssl rand -hex 32>        # generate fresh
PRIVY_APP_ID=...                          # from privy.io
PRIVY_APP_SECRET=...                      # from privy.io  
ANTHROPIC_API_KEY=...                     # for agent execution
AGENT_MASTER_KEY=<openssl rand -hex 32>  # encrypts agent wallets in DB
TREASURY_ADDRESS=<your-wallet>           # receives 5% platform fees
```

### Step 6 — Test locally

```bash
# Terminal 1
npx ts-node api/index.ts

# Terminal 2
npx ts-node agents/runner/index.ts

# Terminal 3
cd frontend && npm run dev
# open http://localhost:3010

# Verify with:
PRIVY_SKIP_VERIFY=true npx ts-node scripts/test-tasks.ts
```

### Step 7 — Deploy to production

**API → Railway:**
- Push repo to GitHub, connect to Railway
- Set all `.env` variables as Railway env vars
- Railway auto-detects `railway.json` and runs `npx ts-node api/index.ts`
- Provision a Railway Postgres database, set `DATABASE_URL`

**Frontend → Vercel:**
- Import GitHub repo to Vercel
- Set the `NEXT_PUBLIC_*` env vars in Vercel project settings
- `frontend/vercel.json` handles the Next.js build config
- Set `NEXT_PUBLIC_API_URL` to your Railway API URL

**Runner → Railway (separate service):**
- Add a second Railway service pointing to the same repo
- Set start command to `npx ts-node agents/runner/index.ts`
- Share the same env vars (DATABASE_URL, AGENT_MASTER_KEY, ANTHROPIC_API_KEY)

### Customisation ideas

| What to change | Where |
|---|---|
| Agent system prompt defaults | `api/routes/agents.ts` — `systemPrompt` field |
| Token name / symbol | `contracts/TaskToken.sol` constructor args |
| Staking lockup duration | `contracts/TaskStaking.sol` — `LOCK_PERIOD` constant |
| Platform fee % | `contracts/SatisfactionEscrow.sol` — `PLATFORM_FEE_BPS` |
| Verified stake threshold | `TaskStaking.setMinStake()` on-chain call |
| Pipeline max steps | `api/routes/tasks.ts` — zod schema `.max(20)` |
