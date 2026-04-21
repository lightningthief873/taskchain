# Backend agents + facilitator + API — shared image, command overridden per service in docker-compose.yml
FROM node:20-alpine

# curl for docker healthchecks
RUN apk add --no-cache curl

WORKDIR /app

# Copy Prisma schema before npm ci so postinstall can generate the client
COPY package*.json ./
COPY prisma ./prisma

# Install all deps (devDeps needed: ts-node, typescript, hardhat types)
# Prisma postinstall will auto-run `prisma generate` after npm ci
RUN npm ci

# Copy remaining source (frontend/ and .env excluded via .dockerignore)
COPY . .

# Default command — overridden by docker-compose for each service
CMD ["npx", "ts-node", "--project", "tsconfig.json", "agents/router/index.ts"]
