# TaskChain — Project Context for Claude Code

## What This Project Is

TaskChain is an autonomous multi-agent task economy on Avalanche.
A router agent accepts a plain-English task, decomposes it, hires specialist AI micro-agents from an on-chain marketplace via x402 HTTP payments, validates their output, and delivers the composed result — no human approval required at any step.

## Hackathon Requirements (Must Satisfy All)

- Deploy on Avalanche C-Chain (Fuji testnet)
- Use x402 protocol for HTTP-native stablecoin payments (USDC)
- Use ERC-8004 for on-chain agent identity and reputation
- Use Avalanche SDK for all chain interactions
- Payments triggered programmatically, settled instantly, gated by reputation

## Tech Stack

- Runtime: Node.js 20, TypeScript strict mode
- Smart Contracts: Solidity 0.8.24, Hardhat, ethers.js v6
- Payments: x402-axios (client), x402-express (server middleware)
- Chain: Avalanche Fuji C-Chain (chainId 43113)
- Stablecoin: USDC on Fuji testnet
- AI Services: Anthropic Claude API (claude-sonnet-4-20250514) behind x402 paywalls
- Frontend: Next.js 14 App Router, Tailwind CSS
- Infra: Docker Compose for local dev, Railway or Render for hosted deployment

## Repository Structure

```
taskchain/
├── contracts/
│   ├── AgentRegistry.sol     # ERC-8004: register agents, store reputation score
│   └── TaskEscrow.sol        # Optional: escrow payment until task verified
├── agents/
│   ├── router/               # Orchestrator: decomposes tasks, pays sub-agents
│   │   ├── index.ts
│   │   ├── decomposer.ts     # LLM call to break task into subtasks
│   │   ├── selector.ts       # Query registry, rank by reputation + price
│   │   └── executor.ts       # Call each agent via x402, chain outputs
│   ├── translator/           # Sub-agent: translates text, x402-gated endpoint
│   ├── analyzer/             # Sub-agent: analyzes CSV/JSON data
│   └── writer/               # Sub-agent: writes formatted summaries
├── x402/
│   ├── middleware.ts          # Express x402 payment middleware setup
│   └── client.ts             # Axios client with x402 payment headers
├── frontend/
│   ├── app/
│   │   ├── page.tsx           # Task input UI
│   │   └── dashboard/page.tsx # Live payment flow visualization
│   └── components/
│       ├── TaskInput.tsx
│       ├── AgentCard.tsx
│       └── PaymentFeed.tsx    # Real-time on-chain event stream
├── scripts/
│   ├── deploy.ts              # Deploy AgentRegistry + TaskEscrow to Fuji
│   ├── register-agents.ts    # Register all agents on-chain with ERC-8004
│   └── fund-agents.ts        # Fund agent wallets from faucet for testing
├── shared/
│   ├── types.ts              # Task, Agent, SubTask, PaymentEvent interfaces
│   └── config.ts            # Chain config, contract addresses, env vars
├── docker-compose.yml
├── hardhat.config.ts
├── package.json
└── .env.example
```

## Environment Variables Required

```
# Avalanche Fuji
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
DEPLOYER_PRIVATE_KEY=       # wallet with test AVAX for gas
ROUTER_AGENT_PRIVATE_KEY=   # router agent wallet
TRANSLATOR_AGENT_PRIVATE_KEY=
ANALYZER_AGENT_PRIVATE_KEY=
WRITER_AGENT_PRIVATE_KEY=

# Contract Addresses (populated after deploy script)
AGENT_REGISTRY_ADDRESS=
TASK_ESCROW_ADDRESS=

# AI
ANTHROPIC_API_KEY=

# x402
PAYMENT_FACILITATOR_URL=https://x402.org/facilitator
USDC_CONTRACT_ADDRESS=      # USDC on Fuji testnet

# Frontend
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

## Key Implementation Rules

1. Every agent runs as an Express server with x402 middleware on its POST /execute endpoint.
2. The router agent never stores private keys for sub-agents. Each agent holds its own wallet and signs its own payments.
3. Reputation is updated on-chain after every successful task completion. Call AgentRegistry.recordCompletion(agentAddress, taskId, success).
4. All monetary values are in USDC with 6 decimal places. Never use ETH for payments.
5. x402 payment flow: router calls agent endpoint → 402 response with payment details → router signs and sends USDC → agent verifies payment → agent executes and returns result.
6. Frontend subscribes to AgentRegistry events via WebSocket (ethers.js provider) to show live payment feed.
7. Error handling: if a sub-agent fails or payment bounces, router marks that agent's reputation as failed and retries with next-best agent.

## Build Phases

- Phase 1 (MVP): ✅ COMPLETE (tested 2026-04-18) — Translator + x402 paywall + ERC-8004 registry on Fuji.
- Phase 2: ✅ COMPLETE (tested 2026-04-18) — Router + analyzer + writer + translator pipeline. 3 on-chain payments confirmed.
- Phase 3: ✅ BUILT (2026-04-18) — Next.js 16 frontend. Task input page + live dashboard. Runs on port 3010.
- Phase 4: Docker Compose packaging + hosted deployment. Proves shippability.

## Phase 1 Implementation Notes

### Key Technical Decisions
- Using `@x402/express`, `@x402/axios`, `@x402/evm` (v2 scoped packages, not legacy `x402-express`/`x402-axios`)
- `@x402/evm` DEFAULT_STABLECOINS does NOT include Fuji (eip155:43113) — work around by passing `price` as `AssetAmount` object `{ amount: "10000", asset: "0x5425890...", extra: {...} }` directly in route config, bypassing the string-to-USDC lookup
- TypeScript config: `module: "Node16"`, `moduleResolution: "node16"` — required for x402 subpath exports (`@x402/evm/exact/server`, etc.) while keeping CommonJS runtime compatibility for ts-node
- Facilitator: `https://facilitator.ultravioletadao.xyz` for Fuji (official `https://facilitator.x402.org` only supports Base/Polygon/Arbitrum)
- USDC on Fuji: `0x5425890298aed601595a70AB815c96711a31Bc65` (Circle testnet USDC)

### Generated Wallets (testnet only)
- DEPLOYER:    `0x3fba67E4fD7B82390cF38C88388feF4bB871a661` — needs test AVAX (gas)
- ROUTER:      `0x962135CbDa2f1f33ef3aB1a3afdbd3bDa3e649ce` — pays sub-agents (needs USDC); ~19.97 USDC remaining
- TRANSLATOR:  `0x106927178B6a28efFF6fad138443E3d898fe2Ac8` — receives USDC; needs AVAX for recordCompletion
- ANALYZER:    `0xADa0D502dD3d51B3A0f1E26d8C6826Bb7D456BeF` — registered on-chain; **needs AVAX from faucet**
- WRITER:      `0xEeA0d97AEe6d8eCFCEb69De9479e15C3ee843840` — registered on-chain; **needs AVAX from faucet**

### Phase 1 — COMPLETE ✅ (tested 2026-04-18)

**On-chain addresses (Fuji):**
- AgentRegistry: `0xdDe74f96020161783d2663999f531a316904105e`
- Explorer: https://testnet.snowtrace.io/address/0xdDe74f96020161783d2663999f531a316904105e

**Confirmed on-chain events:**
- Deploy tx: `0x49a345df58053c78c43b1f0d4da5413deebb16c5ae1db7b29295af745a6d322e`
- Register translator tx: `0x7295cfada8cf56fe5ca0bc88ef173e908410cbb1010de692c7530a09c1fa4733`
- Payment settlement tx: `0x8a09ce7b9509351d220773f90e279cb507578f5c7a66764e766e28bf22790a02`
- Reputation record tx: `0x453c02eea8dda057be7d03c7b986e6b467d2cdd39ea0b62deb3ecdd4af7f1f22`

**Final state after test:**
- Router USDC: 19.97 (paid 0.03 across 3 test runs)
- Translator USDC: 0.03 received
- Translator reputation: successes=1, failures=0, score=100/100

**MOCK_TRANSLATION env var:** Set to `true` to bypass Anthropic API for x402 loop testing (Anthropic key has 0 credits). Real translation requires funded Anthropic account.

**To run Phase 1:**
```bash
# Terminal 1 — local facilitator
npx ts-node x402/facilitator.ts

# Terminal 2 — translator agent
npx ts-node agents/translator/index.ts
# Add MOCK_TRANSLATION=true for testing without Anthropic credits

# Terminal 3 — test
npx ts-node scripts/test-payment.ts
```

### Phase 2 — COMPLETE ✅ (built + tested 2026-04-18)

**New agents:**
- `agents/analyzer/index.ts` — port 3002, stats on numeric arrays, MOCK_ANALYSIS bypass
- `agents/writer/index.ts` — port 3003, prose summary via Claude, MOCK_WRITING bypass
- `agents/router/` — port 3000, decomposes + orchestrates pipeline via x402-axios
  - `decomposer.ts` — Anthropic decomposition + MOCK_DECOMPOSITION bypass
  - `selector.ts` — queries AgentRegistry reputation, maps type → agent URL
  - `executor.ts` — sequential x402-axios calls, chains outputs

**On-chain registration txs:**
- Register analyzer tx: `0x131eb68ae4ef07a6a532318e3eae7255f96fae117a33e7c99175ca7667037c7b`
- Register writer tx: `0x2e4d28babe51c66d45369af7fcdf53404116fe8093c55c7b278ce6a23e2df384`

**Mock env vars for testing without API credits:**
- `MOCK_DECOMPOSITION=true` — router uses static analyzer→writer→translator plan
- `MOCK_ANALYSIS=true` — analyzer returns fixed stats without computation
- `MOCK_WRITING=true` — writer returns hardcoded paragraph
- `MOCK_TRANSLATION=true` — translator returns hardcoded Spanish

**To run Phase 2 full flow test (all mocks, no API credits needed):**
```bash
# Add to .env:
# MOCK_DECOMPOSITION=true
# MOCK_ANALYSIS=true
# MOCK_WRITING=true
# MOCK_TRANSLATION=true

# Terminal 1
npx ts-node x402/facilitator.ts

# Terminal 2
npx ts-node agents/analyzer/index.ts

# Terminal 3
npx ts-node agents/writer/index.ts

# Terminal 4
npx ts-node agents/translator/index.ts

# Terminal 5
npx ts-node agents/router/index.ts

# Terminal 6
npx ts-node scripts/test-full-flow.ts
```

**Prerequisite before running:** Fund ANALYZER (`0xADa0D502dD3d51B3A0f1E26d8C6826Bb7D456BeF`) and WRITER (`0xEeA0d97AEe6d8eCFCEb69De9479e15C3ee843840`) with AVAX from https://faucet.avax.network/ (needed for `recordCompletion` gas).

**Tested 2026-04-18 — 3 on-chain payments confirmed:**
- Analyzer payment: `0x9f4bc834abced56dd4790301331b449ebca638d638e4f790346fa75f39daaf79`
- Writer payment:   `0x5f83a6a6191671397d090cac17ee2c1b098f34f0f2e0ad1fb549cc018f870556`
- Translator payment: `0x767a365687d5eb7566f51476863165ed20cce15b75f44c2bd0f16b41895fbfa2`
- Translator reputation: `0x20b8634cdb43d6b89ee5e10e93cd6322bbff7e1df7c1e6e3ab45e1c32a1706ab`
- Analyzer/Writer reputation: failed (no AVAX) — fund wallets above to fix

### Phase 3 — COMPLETE ✅ (built + tested 2026-04-18)

Next.js 16 frontend on port 3010. Tested end-to-end: frontend proxy returns full pipeline response with all 3 steps and finalResult. 6 on-chain payment settlements confirmed across 2 test runs.

**IMPORTANT — startup must use absolute paths for ts-node:**
```bash
# Always use absolute paths to avoid working-directory issues with ts-node
TDIR="/c/Users/Atharav Jadhav/Mosin/Avalanch/taskchain"
npx ts-node "$TDIR/x402/facilitator.ts"
npx ts-node "$TDIR/agents/analyzer/index.ts"
npx ts-node "$TDIR/agents/writer/index.ts"
npx ts-node "$TDIR/agents/translator/index.ts"
npx ts-node "$TDIR/agents/router/index.ts"
# Then: cd frontend && npm run dev  (port 3010)
```

## Commands

```bash
# Install
npm install

# Compile contracts
npx hardhat compile

# Deploy to Fuji
npx ts-node scripts/deploy.ts

# Register agents on-chain
npx ts-node scripts/register-agents.ts

# Start all agents locally
docker-compose up

# Start frontend
cd frontend && npm run dev

# Run full integration test
npx ts-node scripts/test-full-flow.ts
```

## Machine Specs (Dev Environment)

- CPU: Intel i7 11th Gen
- RAM: 16GB
- SSD: 110GB free
- GPU: Iris Xe (no CUDA, run all AI via API not local models)
- OS: Windows 11.

## Do Not

- Do not run local LLMs (no CUDA, not enough VRAM)
- Do not use mainnet (Fuji testnet only for hackathon)
- Do not use MetaMask in the agent flow (agents are headless wallets)
- Do not use ethers.js v5 (use v6 syntax throughout)
- Do not add any npm package without checking it works with Node 20

## Definition of Done

- [ ] AgentRegistry and TaskEscrow deployed on Fuji, addresses in .env
- [ ] All 4 agents running and reachable via HTTP
- [ ] Router can decompose a 3-step task and pay 3 agents end-to-end
- [ ] Reputation updates confirmed on-chain after each task
- [ ] Frontend shows task input + live payment feed
- [ ] docker-compose up brings the entire stack online in one command
- [ ] README has a 5-step quickstart
