# Solana Staking Indexer System Design

## Overview

The Solana Staking Indexer is a specialized blockchain indexing service designed to monitor, parse, and store data from a Solana-based staking program. It provides reliable, exactly-once ingestion of blockchain transactions and maintains synchronized database state with on-chain accounts.

## Core Components

### 1. Main Indexer (`StakingIndexer`)
The central orchestrator that initializes and manages all subsystems:
- Database connection (Prisma ORM)
- RPC client with failover support
- Transaction ingestion pipeline
- Background job scheduler for various maintenance tasks

### 2. Transaction Ingestion Pipeline

#### TransactionIngestor
Handles the end-to-end processing of blockchain transactions:
- Fetches transactions by signature from RPC nodes
- Parses transaction data using deterministic priority ordering
- Applies ingestion contract to ensure exactly-once processing
- Records parsed data to database
- Enqueues alerts for significant events

#### TransactionParser
Extracts meaningful data from raw Solana transactions with a strict priority order:
1. **Anchor Events** (highest priority) - Parsed from program logs
2. **Instructions** - Direct instruction parsing with program ID validation
3. **Logs** (fallback) - Pattern matching in transaction logs

The parser ensures deterministic results by using the highest priority available data source and ignoring lower-priority sources when higher ones are present.

#### IngestionContract
Guarantees exactly-once processing semantics:
- Tracks processing state for each transaction signature
- Prevents duplicate processing through database-level constraints
- Provides retry mechanisms for transient failures
- Maintains idempotency through unique constraints on signatures

### 3. Data Storage Layer

The indexer uses a PostgreSQL database via Prisma ORM with the following key tables:

#### txActivity
Stores parsed transaction events and instructions:
- Signature (unique constraint for idempotency)
- Slot and block time for temporal indexing
- Event type and version
- Parsed parameters (amounts, user addresses, pool IDs)
- Status (confirmed, finalized, etc.)
- Metadata (raw parsed data)

#### pool
Tracks staking pool state:
- Pool identifier and associated mints
- Configuration parameters (APR, lock duration)
- Current state (staked amounts, reward information)
- Last updated slot for freshness tracking
- Creation transaction hash for provenance

#### userPosition
Tracks individual user stakes:
- User authority and associated pool
- Staked share amounts
- Reward debt tracking
- Timestamps for deposits and locks
- Last updated slot

### 4. Background Jobs

#### AccountSyncJob
Periodically synchronizes on-chain account state:
- Fetches all program accounts for the staking program
- Filters by account discriminators (Pool vs UserPosition)
- Decodes account data using binary layout or IDL
- Upserts to database with last_updated_slot tracking
- Handles batching and bounded concurrency

#### GapFillJob
Ensures slot continuity in transaction processing:
- Monitors for missing slots in processed range
- Fetches signatures for gaps using getSignaturesForAddress
- Processes missing transactions to prevent data holes
- Critical for maintaining complete historical record

#### BackfillJob
Historical data ingestion:
- Uses getSignaturesForAddress to fetch all historical signatures
- Processes transactions in batches with configurable limits
- Can run continuously or for a limited number of pages
- Includes cursor reset functionality

#### ReconcilerJob
Periodic consistency verification:
- Compares on-chain state with database state
- Identifies and reports discrepancies
- Can trigger automatic corrections for certain issue types

#### AlertProcessorJob
Handles event-driven notifications:
- Processes queued alerts from transaction ingestion
- Sends notifications via configured channels (email, webhook, etc.)
- Implements rate limiting and deduplication

#### FinalizerJob
Confirms transaction finality:
- Moves transactions from "confirmed" to "finalized" status
- Processes transactions that have reached sufficient confirmations
- Updates dependent data that requires finality guarantees

#### PartitionTunerJob
Database maintenance:
- Ensures future table partitions exist for time-series data
- Optimizes query performance on large datasets
- Manages retention policies for historical data

### 5. Reliability Features

#### Exactly-Once Guarantee
- Database unique constraints on transaction signatures
- Ingestion contract state tracking
- Idempotent database operations (upserts)

#### Error Handling and Recovery
- Retry mechanisms with exponential backoff
- Dead letter queues for repeatedly failing items
- Health checks and circuit breakers for RPC connections
- Graceful shutdown procedures

#### Monitoring and Observability
- Structured logging with contextual information
- RPC client metrics (latency, error rates)
- Job execution timing and success/failure tracking
- Database connection pool monitoring

### 6. Processing Flow

1. **Transaction Ingestion**
   - External trigger (CLI, API, or scheduled job) requests processing of a signature
   - TransactionIngestor fetches transaction from RPC
   - TransactionParser extracts data using priority order (events → instructions → logs)
   - IngestionContract ensures exactly-once processing
   - Parsed data recorded to txActivity table
   - Alerts enqueued for significant events

2. **Account Synchronization**
   - AccountSyncJob fetches all program accounts
   - Accounts filtered by discriminator (Pool/UserPosition)
   - Account data decoded and upserted to database
   - Last updated slot tracked for freshness

3. **Gap Management**
   - GapFillJob monitors processed slot range
   - Detects missing slots and fetches signatures
   - Missing transactions processed through normal ingestion pipeline
   - Ensures continuous historical record

### 7. Configuration

The indexer is configured through environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `RPC_ENDPOINT`: Primary Solana RPC endpoint
- `RPC_ENDPOINT_FALLBACK`: Comma-separated fallback RPC endpoints
- `STAKING_PROGRAM_ID`: Address of the staking program on-chain
- `PROCESSING_TIMEOUT_MS`: Timeout for transaction processing

### 8. CLI Interface

The indexer provides a rich command-line interface:
- `process <signature>`: Process a single transaction
- `batch <sig1> <sig2>...`: Process multiple transactions
- `sync-accounts`: Perform one-time account synchronization
- `start-sync [intervalMs]`: Start periodic account sync
- `start-gap-fill [intervalMs]`: Start gap filling scheduler
- `reconcile`: Run one reconciliation pass
- `start-reconciler [intervalMs]`: Start periodic reconciliation
- `backfill [maxPages]`: Process historical transactions
- `reset-cursor`: Reset gap-fill cursor to current slot
- `status`: Show current indexer status

## Data Flow Summary

1. Blockchain transactions are ingested via signature lookup
2. Transactions are parsed using deterministic priority ordering
3. Ingestion contract ensures exactly-once processing
4. Parsed data is stored in normalized database tables
5. Background jobs maintain data consistency and completeness
6. Alerts are generated for significant on-chain events
7. Account state is periodically synchronized with on-chain data
8. Gaps in slot processing are automatically detected and filled

## Scalability Considerations

- Bounded concurrency in account synchronization prevents resource exhaustion
- Pagination limits in backfill operations allow controlled historical ingestion
- Database indexing strategy optimized for common query patterns
- Modular job architecture allows independent scaling of components
- RPC client load balancing across multiple endpoints

## Failure Modes and Mitigations

- **RPC Endpoint Failure**: Automatic failover to configured backup endpoints
- **Database Connection Loss**: Retry with exponential backoff and circuit breaker
- **Processing Backlog**: Horizontal scaling through multiple indexer instances
- **Data Inconsistencies**: Reconciliation job detects and reports discrepancies
- **Slot Gaps**: Gap fill job automatically detects and processes missing slots

This design provides a robust, reliable indexing solution for Solana staking programs that maintains data integrity while scaling to handle high transaction volumes.