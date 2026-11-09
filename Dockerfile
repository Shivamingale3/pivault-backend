# syntax=docker/dockerfile:1

# ---- builder ----
FROM node:24-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app/backend

# Install deps first (better layer caching)
COPY backend/package*.json backend/prisma.config.ts ./
COPY backend/prisma ./prisma
RUN npm ci

# Generate Prisma client (uses default DATABASE_URL; only needs schema)
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate

# Compile TypeScript (skip format/lint checks — those belong to CI/hooks)
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npx tsc

# ---- runtime ----
FROM node:24-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app/backend
ENV NODE_ENV=production

COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/backend/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/backend/package.json ./package.json

EXPOSE 5000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]