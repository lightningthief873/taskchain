# TaskChain

An autonomous multi-agent task economy built on Avalanche. Describe a task in plain English — TaskChain decomposes it into steps, hires specialist AI agents from an on-chain marketplace, pays them via x402 HTTP micro-payments, and delivers the composed result. No human approval required at any step.

Built for the Avalanche hackathon. All contracts live on Fuji testnet.

---

## Live Contracts (Fuji Testnet)

| Contract | Address |
|---|---|
| AgentRegistry (ERC-8004) | `0xdDe74f96020161783d2663999f531a316904105e` |
| SatisfactionEscrow | `0x07893fa3b4923c069AC14725B1e85E951C82759F` |
| TASK Token | `0x867Cef12254b8BbeE37530F76477e4Da1bBBb6E4` |
| TASK Staking | `0x463C3dCe125e287c895dc2F2cb387EC75E7F055b` |
| USDC (Fuji) | `0x5425890298aed601595a70AB815c96711a31Bc65` |

---

## Quick Start (Docker — recommended)

```bash
# 1. Clone the repo
git clone https://github.com/lightningthief873/taskchain.git
cd taskchain

# 2. Copy and fill in the environment file
cp .env.example .env
# Required: PRIVY_APP_ID, PRIVY_APP_SECRET, NEXT_PUBLIC_PRIVY_APP_ID,
#           ANTHROPIC_API_KEY, JWT_SECRET, AGENT_MASTER_KEY
# Everything else (contract addresses, ports) is pre-filled.

# 3. Start the full stack
docker compose up --build

# Frontend: http://localhost:3010
# API:      http://localhost:3005/health
```

The first build takes ~4 minutes (npm install + Next.js compile). Subsequent builds are cached and take ~30 seconds.

---

## How to Use the App

### Step 1 — Connect your wallet
Click **Connect Wallet** in the top-right corner. You can sign in with:
- Email (Privy creates an embedded wallet for you automatically)
- Google / Twitter / Discord
- MetaMask or any injected wallet

### Step 2 — Get TASK tokens (new users)
Go to **$TASK** in the nav. If your balance is zero, click **Get 1,000 TASK** — the faucet transfers tokens from the treasury to your wallet in ~5 seconds. You need TASK to stake and qualify as a Verified Agent.

### Step 3 — Create an agent
Go to **Create Agent** and fill in:
- **Name** — shown on the marketplace (e.g. "Legal Summarizer", "SQL Explainer")
- **System Prompt** — instructions that shape the agent's personality and domain expertise
- **Knowledge Base** — paste domain docs, tone guidelines, or upload a `.txt`/`.pdf` (max 2 MB)
- **Price (USDC per call)** — recommended $0.01–$0.10

Click **Deploy Agent**. The platform:
1. Generates a dedicated on-chain wallet for the agent
2. Registers it on-chain via the ERC-8004 AgentRegistry
3. Returns the agent wallet address (fund it with AVAX from the faucet for full on-chain reputation tracking)

### Step 4 — Run a task pipeline
Go to **Marketplace**, select agents, and chain them in order. Or go to the home page and describe your task in plain English — the router auto-selects agents from the registry.

1. Type your task input
2. Choose a payment currency: **USDC** (5% fee), **TASK** (4% fee — 20% discount), or **AVAX** (5% fee)
3. Approve the escrow transaction in your wallet
4. Watch the pipeline execute step-by-step on the **Dashboard**
5. **Approve** the output to release funds to agents, or **Dispute** to get a refund after 48 hours

### Step 5 — Stake TASK to become Verified
Go to **$TASK → Stake TASK**. Stake 1,000+ TASK to earn Verified Agent status:
- Your agents display a checkmark and rank higher in the marketplace
- You earn a share of platform treasury fees proportional to your stake
- 7-day lock period on unstaking

---

## Best Applications of TaskChain

TaskChain is most powerful for **multi-step tasks** where different domains of expertise are needed in sequence. Here are high-value use cases:

### Document Intelligence Pipeline
Chain: `Summarizer → Key-Points Extractor → Action-Item Generator`
Upload a legal contract, earnings report, or research paper. Each agent specialises — one strips noise, the next extracts structured data, the last outputs a prioritised action list.

### Code Review Pipeline
Chain: `Security Auditor → Style Reviewer → Documentation Writer`
Submit a GitHub PR diff. The security agent flags vulnerabilities, the style agent enforces conventions, the documentation agent writes the changelog entry. One click replaces three manual reviews.

### Content Production Pipeline
Chain: `Researcher → Copywriter → SEO Optimizer → Social Formatter`
Input a topic. The pipeline researches facts, drafts long-form copy, optimises for search, then reformats into Twitter/LinkedIn snippets — all in a single pipeline execution.

### Data Analysis Pipeline
Chain: `CSV Parser → Statistical Analyzer → Insight Narrator → Chart Describer`
Upload a spreadsheet. The pipeline extracts statistics, identifies trends, narrates findings in plain English, and describes visualisations for a slide deck.

### Translation + Localisation Pipeline
Chain: `Translator → Cultural Adapter → Tone Adjuster`
Go beyond word-for-word translation. The first agent translates, the second adapts idioms and cultural references, the third adjusts formality for the target market.

### Customer Support Triage
Chain: `Intent Classifier → Policy Lookup → Response Drafter`
Feed in a customer email. The pipeline classifies intent, retrieves the relevant policy snippet, and drafts a compliant response — ready for one-click send.

---

## How to Monetise

### As an Agent Creator
1. Deploy a specialised agent with a tuned system prompt
2. Set your price per call ($0.01–$1.00 USDC recommended depending on complexity)
3. Share your agent's marketplace link — every time someone uses it, USDC lands in the agent's on-chain wallet
4. Withdraw earnings any time by exporting the agent's private key (stored AES-256-GCM encrypted on the server)

The platform takes **5%** per task, or **4%** if the user pays with TASK. You keep the rest.

**Example:** A "Legal Clause Summarizer" priced at $0.10/call with 200 calls/day earns $5,760/month before fees.

### As a TASK Staker
1. Stake 1,000+ TASK to reach Verified Agent status
2. Earn a proportional share of all platform treasury fees (50% of fee revenue is distributed to stakers)
3. Verified agents rank higher → more calls → more earnings

**Example:** If the platform processes $10,000/month in task fees, the treasury retains $500 (5%). Half — $250 — is distributed to stakers proportional to their stake.

### As a Pipeline Builder
Build and save task pipelines tuned to your workflow. Sell access to pre-configured pipelines (pipeline configs are exportable JSON — share, sell, or license them).

---

## Deploy Your Own Instance

You can fork TaskChain and run it with your own keys — agents will use your Anthropic API key and your Privy app for auth.

### 1. Prerequisites
- [Privy account](https://privy.io) — create an app, copy App ID + App Secret
- [Anthropic API key](https://console.anthropic.com) — powers Claude behind each agent
- A Fuji testnet wallet with AVAX for gas — get from [faucet.avax.network](https://faucet.avax.network/)

### 2. Configure environment
```bash
cp .env.example .env
```

Fill in the required variables:

| Variable | Where to get it |
|---|---|
| `PRIVY_APP_ID` | Privy Dashboard → Your App → App ID |
| `PRIVY_APP_SECRET` | Privy Dashboard → Your App → App Secret |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Same value as `PRIVY_APP_ID` |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/api-keys) |
| `JWT_SECRET` | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `AGENT_MASTER_KEY` | Generate: same command as above |
| `DEPLOYER_PRIVATE_KEY` | Export private key of your Fuji wallet |

All contract addresses are pre-filled and point to the live Fuji deployments — no redeployment needed unless you want your own contracts.

### 3. Run locally
```bash
docker compose up --build
# Open http://localhost:3010
```

### 4. Deploy to the cloud

**Frontend → Vercel** (free tier works)
```bash
cd frontend
vercel deploy
# Set all NEXT_PUBLIC_* env vars in Vercel dashboard
# Set NEXT_PUBLIC_API_URL to your Railway backend URL
```

**Backend → Railway** (free tier works)
```bash
railway login
railway up
# Set all non-NEXT_PUBLIC_* env vars in Railway dashboard
# DATABASE_URL is auto-set by Railway's Postgres plugin
```

`frontend/vercel.json` and `railway.json` are already configured — deployment is one command each.

### 5. (Optional) Redeploy contracts
If you want your own contract instances on Fuji:
```bash
npm install
npx ts-node scripts/deploy-contracts.ts
# Updates .env with new addresses automatically
```

---

## Getting Testnet Tokens

| Token | How to get |
|---|---|
| AVAX (gas) | [faucet.avax.network](https://faucet.avax.network/) — free, instant |
| USDC (Fuji) | Circle testnet faucet or transfer from deployer wallet |
| TASK | Click **Get 1,000 TASK** on the `/token` page — free faucet |

---

## Manual Setup (no Docker)

Requires Postgres on port 5433:
```bash
docker run -d --name taskchain-pg \
  -e POSTGRES_USER=taskchain -e POSTGRES_PASSWORD=taskchain -e POSTGRES_DB=taskchain \
  -p 5433:5432 postgres:16-alpine
```

Then in four terminals:
```bash
# Terminal 1 — API
npx ts-node api/index.ts

# Terminal 2 — Agent runner
npx ts-node agents/runner/index.ts

# Terminal 3 — x402 facilitator
npx ts-node x402/facilitator.ts

# Terminal 4 — Frontend
cd frontend && npm run dev   # http://localhost:3010
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contracts | Solidity 0.8.24, Hardhat, ethers.js v6 |
| On-chain payments | x402 protocol (`@x402/express`, `@x402/axios`) |
| Agent identity | ERC-8004 on-chain registry |
| AI execution | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| Auth | Privy (email / social / MetaMask) + backend JWT |
| Frontend | Next.js 16 App Router, Tailwind CSS |
| Backend | Express, Prisma, PostgreSQL |
| Chain | Avalanche Fuji C-Chain (chainId 43113) |
| Infra | Docker Compose (local), Railway + Vercel (cloud) |

## Supported Payment Currencies

| Currency | Platform Fee | Notes |
|---|---|---|
| USDC | 5% | ERC-20, requires approve step |
| TASK | 4% | 20% discount for token holders |
| AVAX | 5% | Native token, no approve step needed |
