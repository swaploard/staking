# Solana Staking Platform

A comprehensive staking platform built on the Solana blockchain, enabling users to stake SOL tokens, earn rewards, and manage staking positions through a modern web interface.

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Getting Started](#getting-started)
- [Development](#development)

## Project Overview

This project is a complete staking ecosystem consisting of three main components:

1. **Smart Contracts** - Rust/Anchor programs that manage on-chain staking logic
2. **Indexer** - A reliable off-chain service that synchronizes blockchain state with a PostgreSQL database
3. **Web Client** - A Next.js frontend for users to interact with staking pools and manage positions

### Key Features

- **Multiple Staking Pools** - Support for different staking pools with varying APY rates and terms
- **Real-time Data** - Indexed blockchain state for instant data queries
- **Position Management** - Track and manage active staking positions
- **Reward Tracking** - Monitor pending and claimed rewards
- **Responsive UI** - Desktop and mobile optimized interface
- **Wallet Integration** - Support for popular Solana wallets (Phantom, Solflare, etc.)
- **Exactly-Once Processing** - Guaranteed reliable transaction ingestion with recovery mechanisms

## Tech Stack

### Frontend
- **Framework**: Next.js 16+ with React 19+
- **UI Components**: Radix UI
- **Styling**: TailwindCSS with PostCSS
- **Web3**: Coral-xyz Anchor SDK, Solana Web3.js
- **Wallet Adapter**: Solana Wallet Adapter React

### Backend/Indexer
- **Language**: TypeScript with Node.js
- **Runtime**: tsx for development
- **Database**: PostgreSQL with Prisma ORM
- **Blockchain Interaction**: Coral-xyz Anchor, Solana Web3.js
- **Logging**: Pino logger
- **Architecture**: Background job-based with RPC failover and retry mechanisms

### Smart Contracts
- **Language**: Rust
- **Framework**: Anchor (Solana program development framework)
- **SPL Tokens**: Solana Program Library for token operations
- **Compilation**: Solana BPF (sBPF)

### Build & Tooling
- **Package Manager**: Yarn/pnpm
- **Rust Toolchain**: Managed via `rust-toolchain.toml`
- **Testing**: Mocha + TypeScript, ts-mocha
- **Code Quality**: Prettier for formatting

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Solana Blockchain                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Staking Smart Contracts (Anchor Program)             │   │
│  │ - Pool creation & management                         │   │
│  │ - Stake deposits & withdrawals                       │   │
│  │ - Reward calculations & distributions                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         ▲                                           │
         │ RPC Calls                                 │ On-chain Events
         │                                           ▼
    ┌────────────────────────────────────────────────────┐
    │          Indexer Service (Node.js/TS)              │
    │ ┌────────────────────────────────────────────────┐ │
    │ │ Components:                                    │ │
    │ │ - Account Sync Job                             │ │
    │ │ - Instruction Ingestion                        │ │
    │ │ - Gap Filler                                   │ │
    │ │ - Finalization & Reconciliation                │ │
    │ │ - RPC Failover & Retry Logic                   │ │
    │ └────────────────────────────────────────────────┘ │
    └────────────────────────────────────────────────────┘
         │ Prisma ORM
         ▼
    ┌────────────────────────────────────────────────────┐
    │     PostgreSQL Database                            │
    │ - Pool data & state                                │
    │ - User positions & balances                        │
    │ - Transaction history                              │
    │ - Account information                              │
    └────────────────────────────────────────────────────┘
         ▲ SQL Queries
         │
    ┌────────────────────────────────────────────────────┐
    │    Web Client (Next.js + React)                    │
    │ ┌────────────────────────────────────────────────┐ │
    │ │ Pages:                                         │ │
    │ │ - Dashboard (overview & balance)               │ │
    │ │ - Pools (discover & browse)                    │ │
    │ │ - Positions (manage stakes)                    │ │
    │ │ - Fund Rewards (admin interface)               │ │
    │ │ - Transaction History                          │ │
    │ └────────────────────────────────────────────────┘ │
    │ ┌────────────────────────────────────────────────┐ │
    │ │ Features:                                      │ │
    │ │ - Wallet connection & signing                  │ │
    │ │ - Real-time data updates                       │ │
    │ │ - State management & hooks                     │ │
    │ │ - Responsive UI components                     │ │
    │ └────────────────────────────────────────────────┘ │
    └────────────────────────────────────────────────────┘
```

### Indexer Reliability Features

The indexer implements several reliability mechanisms:

- **Exactly-Once Processing**: Claim-first commit protocol with PostgreSQL unique constraints
- **Crash Recovery**: Timeout-based recovery with automatic lock resets
- **RPC Failover**: Rotating fallbacks with exponential backoff for 429 and 5xx errors
- **Component-Based Jobs**: Modular architecture with separate jobs for different sync tasks

## Project Structure

```
.
├── programs/staking/              # Smart contracts
│   ├── Cargo.toml                 # Rust package configuration
│   └── src/                       # Contract source code
│
├── indexer/                       # Off-chain data indexer
│   ├── package.json               # Node.js dependencies
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema
│   │   └── migrations/            # Database migrations
│   ├── src/
│   │   ├── index.ts               # Entry point
│   │   ├── logger.ts              # Logging setup
│   │   ├── alerts/                # Alert mechanisms
│   │   ├── ingestion/             # Data ingestion jobs
│   │   ├── jobs/                  # Background jobs
│   │   ├── program/               # Program interaction logic
│   │   └── rpc/                   # RPC client & failover
│   └── README.md                  # Indexer-specific docs
│
├── staking_client/                # Next.js web frontend
│   ├── package.json               # React dependencies
│   ├── tsconfig.json              # TypeScript config
│   ├── next.config.mjs            # Next.js configuration
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Home page
│   │   ├── api/                   # API routes
│   │   ├── pools/                 # Pools page & routes
│   │   ├── create_pool/           # Pool creation
│   │   └── fund-rewards/          # Reward funding
│   ├── components/                # Reusable React components
│   │   ├── common/                # Common components
│   │   ├── dashboard/             # Dashboard components
│   │   ├── ui/                    # UI primitives
│   │   ├── providers/             # Context providers
│   │   └── actions/               # Server actions
│   ├── hooks/                     # Custom React hooks
│   │   ├── usePools.ts            # Pool data fetching
│   │   ├── useUserPositions.ts    # User positions
│   │   ├── useWalletActivity.ts   # Activity tracking
│   │   └── use-mobile.ts          # Responsive design
│   ├── lib/                       # Utility functions
│   │   ├── anchor.ts              # Anchor setup
│   │   ├── types.ts               # TypeScript types
│   │   ├── utils.ts               # Helpers
│   │   ├── instructions/          # Transaction builders
│   │   ├── adapters/              # Data adapters
│   │   └── hooks/                 # Library hooks
│   ├── prisma/
│   │   └── schema.prisma          # Client-side database schema
│   ├── public/                    # Static assets
│   ├── styles/                    # Global styles
│   └── README.md                  # Client-specific docs
│
├── tests/                         # Integration tests
│   ├── staking.ts                 # Main staking tests
│   └── create_pool.ts             # Pool creation tests
│
├── trident-tests/                 # Fuzz testing with Trident
│   ├── Cargo.toml
│   ├── Trident.toml
│   └── fuzz_0/                    # Fuzz test programs
│
├── migrations/                    # Migration scripts
│   └── deploy.ts                  # Deployment utilities
│
├── scripts/                       # Utility scripts
│   └── global-config.ts           # Global configuration
│
├── target/                        # Build artifacts
│   ├── debug/                     # Debug builds
│   ├── release/                   # Release builds
│   ├── idl/                       # Interface Definition Language files
│   ├── types/                     # Generated TypeScript types
│   └── sbpf-solana-solana/        # Solana BPF compilation
│
├── test-ledger/                   # Local validator data (gitignored)
│   ├── faucet-keypair.json
│   ├── validator-keypair.json
│   ├── accounts/                  # Validator account data
│   ├── rocksdb/                   # Local ledger state
│   └── snapshots/                 # State snapshots
│
├── Cargo.toml                     # Workspace root
├── Anchor.toml                    # Anchor configuration
├── package.json                   # Root package config
├── tsconfig.json                  # TypeScript configuration
├── rust-toolchain.toml            # Rust version
└── README.md                      # This file
```

## How It Works

### 1. User Interaction Flow

```
User connects wallet
        ↓
Browse available staking pools
        ↓
Stake SOL tokens in a pool
        ↓
Staking program processes transaction
        ↓
Indexer captures on-chain event
        ↓
Database updates with new position
        ↓
Dashboard reflects updated balance & rewards
        ↓
User can view activity history & claim rewards
```

### 2. Data Flow

1. **Transaction Submission**: User connects wallet and submits a staking transaction (deposit, withdraw, claim)
2. **On-Chain Execution**: Anchor smart contract validates and executes the transaction
3. **Event Emission**: Program emits events containing transaction details
4. **Indexer Ingestion**: Indexer service captures events via RPC calls
5. **Database Sync**: Prisma ORM stores/updates data in PostgreSQL
6. **Frontend Query**: Next.js app queries database via API routes or direct DB connection
7. **UI Update**: React components display updated staking positions and rewards

### 3. Key Components

**Smart Contracts** (`programs/staking/`)
- Define pool structure and rules
- Validate stake/unstake operations
- Calculate and distribute rewards
- Maintain global state

**Indexer** (`indexer/`)
- Continuously polls blockchain for new transactions
- Extracts transaction data and account information
- Handles network interruptions and recovery
- Maintains exactly-once processing guarantee
- Provides fast query API for frontend

**Web Client** (`staking_client/`)
- User-friendly interface for staking operations
- Real-time dashboard with balance and rewards
- Pool discovery and comparison
- Transaction history and status tracking

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (for indexer and client)
- Rust 1.70+ (for smart contracts)
- Solana CLI tools
- PostgreSQL 13+ (for indexer)
- A Solana wallet with devnet SOL (for testing)

### Installation

1. **Clone the repository**
   ```bash
   cd /path/to/staking
   ```

2. **Install root dependencies**
   ```bash
   yarn install
   ```

3. **Setup Smart Contracts**
   ```bash
   cd programs/staking
   cargo build
   ```

4. **Setup Indexer**
   ```bash
   cd indexer
   npm install
   npm run db:migrate
   npm run dev
   ```

5. **Setup Web Client**
   ```bash
   cd staking_client
   npm install
   npm run dev
   ```

### Configuration

- **Anchor.toml**: Specifies program IDs, RPC endpoints, and wallet location
- **indexer/.env**: Database connection string and RPC endpoints
- **staking_client/.env.local**: API endpoints and feature flags

##  Development

### Build Smart Contracts
```bash
yarn build
```

### Run Tests
```bash
yarn test              # Run all tests
yarn test tests/staking.ts    # Run specific test
```

### Start Development Services

**Terminal 1 - Local Validator**
```bash
anchor localnet
```

**Terminal 2 - Indexer**
```bash
cd indexer
npm run dev
```

**Terminal 3 - Web Client**
```bash
cd staking_client
npm run dev
```

### Deployment

- **Devnet**: `anchor deploy --provider.cluster devnet`
- **Production**: Follow deployment guides in respective component directories

##  Database Schema

The indexer uses Prisma to manage a PostgreSQL database with tables for:
- Staking pools and their configurations
- User staking positions and balances
- Transaction history and events
- Account state and metadata

See `indexer/prisma/schema.prisma` for the complete schema.

## Security

- Smart contracts use Anchor framework's built-in security checks
- Indexer implements exactly-once processing to prevent data corruption
- Private keys are managed via Solana CLI
- All transactions require wallet signatures

##  License

ISC



---

For more detailed information, refer to the README files in individual component directories:
- [Indexer README](indexer/README.md)
- [Web Client README](staking_client/README.md)
