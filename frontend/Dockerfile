# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Accept build-time NEXT_PUBLIC_* env vars from docker-compose build args
ARG NEXT_PUBLIC_PRIVY_APP_ID
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_FUJI_RPC
ARG NEXT_PUBLIC_AGENT_REGISTRY
ARG NEXT_PUBLIC_ROUTER_URL
ENV NEXT_PUBLIC_PRIVY_APP_ID=$NEXT_PUBLIC_PRIVY_APP_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_FUJI_RPC=$NEXT_PUBLIC_FUJI_RPC
ENV NEXT_PUBLIC_AGENT_REGISTRY=$NEXT_PUBLIC_AGENT_REGISTRY
ENV NEXT_PUBLIC_ROUTER_URL=$NEXT_PUBLIC_ROUTER_URL

RUN mkdir -p public && npm run build

# Runtime stage — only production deps + built output
FROM node:20-alpine AS runner
RUN apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
EXPOSE 3010
CMD ["npm", "start"]
