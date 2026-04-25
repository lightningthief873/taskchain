# Backend services — API, Runner, Facilitator all use this image.
# Command is overridden per service in docker-compose.yml.
FROM node:20-alpine

# curl for healthchecks; openssl required by Prisma query engine on Alpine
RUN apk add --no-cache curl openssl

WORKDIR /app

# Copy Prisma schema first so prisma generate runs during npm ci
COPY package*.json ./
COPY prisma ./prisma

# Install all deps (includes ts-node, typescript — needed at runtime)
RUN npm install

# Copy the rest of the source
COPY . .

CMD ["npx", "ts-node", "api/index.ts"]
