# syntax=docker/dockerfile:1
# Build context: this repo's root (pivault-backend).

# ---- builder ----
FROM node:24-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

# Install deps first (better layer caching)
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

# Generate Prisma client (only needs the schema, not a real database)
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate

# Compile TypeScript (format/lint checks run in CI, not here)
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# ---- runtime ----
FROM node:24-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json

USER node
EXPOSE 5000

# Migrations are NOT run here: Jenkins runs `npx prisma migrate deploy` once in a
# throwaway container before switching. The worker reuses this image with
# `node dist/worker.js`.
CMD ["node", "dist/server.js"]
