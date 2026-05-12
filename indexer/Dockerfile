FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install OpenSSL for Prisma compatibility during build
RUN apk add --no-cache openssl
# Set the binary target for Prisma
ENV PRISMA_BINARY_TARGETS=linux-musl-openssl-3.0.x
RUN npm run build && npm run db:generate

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Install OpenSSL and postgresql-client for Prisma and waiting for db
RUN apk add --no-cache openssl postgresql-client
# Set the binary target for Prisma at runtime
ENV PRISMA_BINARY_TARGETS=linux-musl-openssl-3.0.x

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["npm", "start", "--", "start-sync", "60000"]
