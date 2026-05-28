FROM node:20-alpine AS builder
WORKDIR /workspace
ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
ARG NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
ARG NEXT_PUBLIC_PROGRAM_ID
ARG NEXT_PUBLIC_WS_ENDPOINT

ENV NEXT_PUBLIC_RPC_URL=$NEXT_PUBLIC_RPC_URL
ENV NEXT_PUBLIC_SOLANA_RPC_URL=$NEXT_PUBLIC_SOLANA_RPC_URL
ENV NEXT_PUBLIC_PROGRAM_ID=$NEXT_PUBLIC_PROGRAM_ID
ENV NEXT_PUBLIC_WS_ENDPOINT=$NEXT_PUBLIC_WS_ENDPOINT

RUN apk add --no-cache openssl python3 make g++ linux-headers libusb-dev eudev-dev

# Install root deps for the Solana packages this workspace currently shares.
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

WORKDIR /workspace/staking_client
COPY staking_client/package.json staking_client/package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY staking_client/ ./
COPY target/idl /workspace/target/idl
COPY target/types /workspace/target/types
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /workspace/staking_client
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache openssl

# Copy only what's needed to run
COPY --from=builder /workspace/package.json /workspace/package-lock.json /workspace/
COPY --from=builder /workspace/node_modules /workspace/node_modules
COPY --from=builder /workspace/staking_client/package.json /workspace/staking_client/package-lock.json ./
COPY --from=builder /workspace/staking_client/.next ./.next
COPY --from=builder /workspace/staking_client/public ./public
COPY --from=builder /workspace/staking_client/prisma ./prisma
COPY --from=builder /workspace/staking_client/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "run", "start"]
