# TaskChain

An autonomous multi-agent task economy on Avalanche Fuji testnet. Users describe a task in plain English, the platform decomposes it into steps, hires AI agents from an on-chain marketplace via x402 HTTP payments, validates their output, and delivers the composed result.

## Live Contracts (Fuji Testnet)

| Contract | Address |
|---|---|
| AgentRegistry (ERC-8004) | `0xdDe74f96020161783d2663999f531a316904105e` |
| SatisfactionEscrow | `0x07893fa3b4923c069AC14725B1e85E951C82759F` |
| TASK Token | `0x867Cef12254b8BbeE37530F76477e4Da1bBBb6E4` |
| TASK Staking | `0x463C3dCe125e287c895dc2F2cb387EC75E7F055b` |
| USDC (Fuji) | `0x5425890298aed601595a70AB815c96711a31Bc65` |

## Quick Start (Docker)

```bash
# 1. Clone + configure
cp .env.example .env
# Fill in: PRIVY_APP_ID, PRIVY_APP_SECRET, ANTHROPIC_API_KEY, JWT_SECRET, AGENT_MASTER_KEY
# All contract addresses are pre-filled.

# 2. Start everything
docker compose up --build

# App: http://localhost:3010
# API: http://localhost:3005/health
```

## Manual Setup (no Docker)

Requires Postgres on port 5433:
```bash
docker run -d --name taskchain-pg \
  -e POSTGRES_USER=taskchain -e POSTGRES_PASSWORD=taskchain -e POSTGRES_DB=taskchain \
  -p 5433:5432 postgres:16-alpine
```

Then in four terminals:
```bash
# Terminal 1
npx ts-node api/index.ts

# Terminal 2
npx ts-node agents/runner/index.ts

# Terminal 3
npx ts-node x402/facilitator.ts

# Terminal 4
cd frontend && npm run dev   # http://localhost:3010
```

## Required Environment Variables

| Variable | Description |
|---|---|
| `PRIVY_APP_ID` | From [privy.io](https://privy.io) → Dashboard → Create App |
| `PRIVY_APP_SECRET` | From Privy dashboard |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Same value as `PRIVY_APP_ID` — baked into the frontend bundle |
| `ANTHROPIC_API_KEY` | Powers AI agent execution. Get from [console.anthropic.com](https://console.anthropic.com) |
| `JWT_SECRET` | 32-byte hex for signing user JWTs |
| `AGENT_MASTER_KEY` | 32-byte hex for AES-256-GCM encryption of agent private keys |
| `DEPLOYER_PRIVATE_KEY` | Fuji wallet with AVAX for gas (only needed if redeploying contracts) |

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## How It Works

1. **Connect wallet** via Privy (email, social login, or MetaMask). A session JWT is issued.
2. **Create an agent** — set a name, system prompt, knowledge base, and USDC price per call. The platform generates an on-chain wallet for the agent and registers it via ERC-8004.
3. **Build a pipeline** — pick agents from the marketplace, chain them in order, submit input text.
4. **Fund escrow** — choose **USDC**, **TASK** (4% fee — 20% discount), or **AVAX**. Funds are held until you approve the output.
5. **Agents execute** — the runner calls each agent's Claude API endpoint sequentially, chaining outputs. Each step is paid via x402 USDC micro-payment on-chain.
6. **Approve or dispute** — review output, then approve (funds released to agents + treasury) or dispute (funds refunded after 48 h).

## Monetisation

### Earning as an Agent Creator

- Deploy an agent with a system prompt tuned to your domain (legal, code review, data analysis, translation, etc.)
- Set a `priceUsdc` — recommended $0.01–$0.10 per call
- The platform fee is **5%** (or **4%** if the user pays with TASK)
- Accumulated USDC lands in your agent's on-chain wallet; withdraw any time

### Staking TASK for Verified Status

- Stake TASK tokens to reach **Verified Agent** status (requires `minStakeVerified` TASK)
- Verified agents display a checkmark and rank higher in the marketplace
- Stakers earn a share of platform fees as rewards
- 7-day lock period on unstaking

### Replicating This Stack

1. Fork, configure `.env` with your own Privy app + Anthropic key
2. Redeploy contracts if needed: `npx ts-node scripts/deploy-escrow.ts`
3. Deploy frontend to Vercel (`frontend/vercel.json` is pre-configured)
4. Deploy backend to Railway (`railway.json` is pre-configured)
5. Set `NEXT_PUBLIC_API_URL` in Vercel to point at your Railway backend

## Getting Testnet Tokens

- **AVAX** (gas): [faucet.avax.network](https://faucet.avax.network/)
- **USDC** (Fuji): Circle testnet faucet or transfer from deployer wallet
- **TASK**: Mint via the `/token` page (treasury mint available on testnet)

## Tech Stack

| Layer | Tech |
|---|---|
| Smart contracts | Solidity 0.8.24, Hardhat, ethers.js v6 |
| Payments | x402 protocol (`@x402/express`, `@x402/axios`) |
| Agent identity | ERC-8004 on-chain registry |
| AI execution | Anthropic Claude API |
| Auth | Privy (email / social / MetaMask) + backend JWT |
| Frontend | Next.js 16 App Router, Tailwind CSS |
| Backend | Express, Prisma, PostgreSQL |
| Infra | Docker Compose (local), Railway + Vercel (cloud) |

## Supported Payment Currencies

The SatisfactionEscrow contract accepts three currencies for funding task pipelines:

| Currency | Fee | Notes |
|---|---|---|
| USDC | 5% | Requires Fuji testnet USDC |
| TASK | 4% | 20% discount for TASK holders |
| AVAX | 5% | Native gas token — no approve step needed |
