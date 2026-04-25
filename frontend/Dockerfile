# ── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache curl
WORKDIR /app

# Build-time args — NEXT_PUBLIC_* vars are baked into the JS bundle at build time
ARG NEXT_PUBLIC_API_URL=http://localhost:3005
ARG NEXT_PUBLIC_PRIVY_APP_ID
ARG NEXT_PUBLIC_FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
ARG NEXT_PUBLIC_ESCROW_ADDRESS
ARG NEXT_PUBLIC_TASK_TOKEN_ADDRESS
ARG NEXT_PUBLIC_TASK_STAKING_ADDRESS

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_PRIVY_APP_ID=$NEXT_PUBLIC_PRIVY_APP_ID \
    NEXT_PUBLIC_FUJI_RPC_URL=$NEXT_PUBLIC_FUJI_RPC_URL \
    NEXT_PUBLIC_ESCROW_ADDRESS=$NEXT_PUBLIC_ESCROW_ADDRESS \
    NEXT_PUBLIC_TASK_TOKEN_ADDRESS=$NEXT_PUBLIC_TASK_TOKEN_ADDRESS \
    NEXT_PUBLIC_TASK_STAKING_ADDRESS=$NEXT_PUBLIC_TASK_STAKING_ADDRESS

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public/ ./public/

EXPOSE 3010
# package.json "start" script: next start -p 3010
CMD ["npm", "start"]
