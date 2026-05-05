# Staking Indexer

A resilient, scalable Solana staking program indexer backed by PostgreSQL. It reliably captures, processes, and stores on-chain interactions (events, instructions, accounts) for the staking program, ensuring an exact, exactly-once data pipeline despite network instability or intermittent worker crashes.

## Overview

The purpose of this indexer is to provide a highly reliable off-chain database representing the current on-chain state and transaction history of a Solana Staking Program.

### Key Features
- **Exactly-once Transaction Ingestion**: Uses a claim-first commit protocol backed by PostgreSQL unique constraints to guarantee transactions are processed no more than once.
- **Downtime and Crash Recovery**: Employs timeout-based recovery. If a worker fails midway during processing a transaction, the lock resets automatically and cleanly.
- **Failover RPC Client**: Robust RPC communication with auto-failover, rotating fallbacks, and exponential backoff retry mechanisms for 429/5xx errors.
- **Component-based Architecture**: Breaks down operations into focused, background jobs: Accounts Sync, Gap Filling, Finalization, and Reconciliation.

---

## Architecture Details

### Key Databases & Schema (`prisma/schema.prisma`)
The local database state hinges heavily on two primary constructs designed for idempotency:

1. **`ProcessedSignature`**: A ledger of transaction signatures processed or being processed. It tracks `signature`, `slot`, and `status` (`processing` vs. `completed`) combined with a short timeout window (`updatedAt`) to govern stale ingestions and lock releases.
2. **`TxActivity`**: Contains granular, deterministic priority-driven records of on-chain activities (staking instructions vs. fallback log parsers). A composite constraint `UNIQUE(signature, ixIndex)` securely avoids double-counting instances.

### Deterministic Parsing Priority
When ingesting a transaction, it prioritizes the most reliable source for structured activity:
`Events > Staking Instructions > Log Parsing fallback`

---

## Infrastructure Jobs

Through the CLI, various standalone processes or background schedulers can be started. Under the hood, these rely on isolated jobs:
- **`TransactionIngestor`**: Parses on-chain instructions/events into database operations.
- **`AccountSyncJob`**: Syncs live on-chain Pool and Position accounts to the local DB.
- **`GapFillJob`**: Identifies missing slots or failed blocks in history to ensure continuity limits.
- **`FinalizerJob`**: Periodically flips transaction states from `confirmed` to `finalized` once blocks have sunk deep enough on the network.
- **`ReconcilerJob`**: Discrepancy detector that cross-references final local states vs. true on-chain balances and alerts mismatches.
- **`AlertProcessorJob`**: Dispatches any detected system alerts.

---

## Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+ recommended)
- [PostgreSQL](https://www.postgresql.org/) (v15+)
- A reliable Solana RPC endpoint

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill it out:
```bash
cp .env.example .env
```
Key configurations include:
- `DATABASE_URL`: Your PostgreSQL connection string.
- `RPC_ENDPOINT`: The primary Solana RPC connection.
- `RPC_ENDPOINT_FALLBACK`: Comma-separated list of fallback endpoints.
- `STAKING_PROGRAM_ID`: Base58 public key of the staking program.

### 3. Setup Database Schema
Initialize your PostgreSQL database and run Prisma migrations:
```bash
npm run db:migrate
# OR for local development:
npm run db:migrate:dev
```
To inspect the database manually:
```bash
npm run db:studio
```

---

## Usage Guide (CLI)

The indexer is operated primarily via its built-in CLI using `tsx` (wrapped by `npm run dev --`). We use `node dist/index.js` for production runtime via `npm start`.

### Transaction Ingestion Commands
Process a single transaction signature:
```bash
npm run dev -- process <signature>
```
Process multiple transaction signatures at once:
```bash
npm run dev -- batch <sig1> <sig2> <sig3>
```

### Historical Data Backfill
To index historical transactions from before the indexer was started, use the backfill command. This uses `getSignaturesForAddress` to quickly paginate through history:
```bash
# Backfill all history
npm run dev -- backfill

# Backfill only the most recent N pages (100 signatures per page)
npm run dev -- backfill 1
```

If your indexer is tracking millions of slots behind the live network, you can reset the gap-fill cursor to the current live slot. This is useful after completing a historical backfill to start tracking live data immediately:
```bash
npm run dev -- reset-cursor
```

### Scheduled Daemon Behaviors
Start syncing accounts periodically on a recurring loop (default: every 60s):
```bash
npm run dev -- start-sync 60000
```
Run the account syncer **once** without scheduling:
```bash
npm run dev -- sync-accounts
```

Start the **Gap Filler** to verify block continuity guards (default ping: 30s):
```bash
npm run dev -- start-gap-fill 30000
```
Start the **Finalizer** to upgrade `confirmed` tx to `finalized` (default: 30s):
```bash
npm run dev -- start-finalizer 30000
```
Start the **Reconciler**:
```bash
npm run dev -- start-reconciler 300000
```
Start the **Alert Processor**:
```bash
npm run dev -- start-alerts 15000
```

### Admin & Operations
Ensure required PostgreSQL table partitions exist for `TxActivity`:
```bash
npm run dev -- tune-partitions <start_slot> <end_slot> <partition_size>
```
Simulate load limits to ensure ingestion locks maintain idempotent behaviors:
```bash
npm run dev -- test-idempotency
```
Check health of the indexer and RPC connection:
```bash
npm run dev -- status
```

---

## Building for Production
Pre-transpile for staging/production deployment:
```bash
npm run build
```
Execute the production transpiled output:
```bash
npm run start -- start-sync 60000
```
