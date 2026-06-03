# ---------- deps ----------
FROM node:22-slim AS deps

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate
COPY staking_client/package.json staking_client/pnpm-lock.yaml staking_client/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm rebuild

# ---------- builder ----------
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY staking_client/ .
COPY target/ /target/

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm exec prisma generate
RUN npm run build

# ---------- runner ----------
FROM node:22-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN groupadd -r nextjs && useradd -r -g nextjs nextjs

COPY --from=builder /app/public ./public

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
