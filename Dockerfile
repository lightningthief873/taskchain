# Backend agents + facilitator — shared image, command overridden per service in docker-compose.yml
FROM node:20-alpine

# curl for docker healthchecks
RUN apk add --no-cache curl

WORKDIR /app

# Install all deps (devDeps needed: ts-node, typescript, hardhat types)
COPY package*.json ./
RUN npm ci

# Copy source (frontend/ and .env excluded via .dockerignore)
COPY . .

# Default command — overridden by docker-compose for each service
CMD ["npx", "ts-node", "--project", "tsconfig.json", "agents/router/index.ts"]
