# Solana Staking Client

A modern web application for staking SOL tokens on the Solana blockchain, built with Next.js and Anchor Framework.

## Overview

This project provides a user-friendly interface for staking SOL tokens across multiple staking pools, tracking rewards, and managing staking positions. The client application interacts with Solana smart contracts to provide real-time staking data and transaction capabilities.

## Features

- **Dashboard Overview**: View wallet balance, total staked amount, pending rewards, and lifetime rewards
- **Position Management**: Track active staking positions across different pools
- **Pool Exploration**: Browse available staking pools with different APY rates and terms
- **Transaction History**: Monitor all staking-related activities (deposits, withdrawals, reward claims)
- **Responsive Design**: Optimized for both desktop and mobile experiences
- **Secure Wallet Integration**: Connect with popular Solana wallets (Phantom, Solflare, etc.)

## Technology Stack

- **Frontend Framework**: Next.js 16.2.0 with React 19.2.4
- **Styling**: Tailwind CSS with custom components
- **State Management**: Zustand
- **Forms**: React Hook Form with Zod validation
- **UI Components**: Radix UI primitives
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Blockchain Interaction**: @coral-xyz/anchor
- **Database**: Prisma ORM
- **Icons**: Lucide React

## Project Structure

```
staking_client/
├── app/                     # Next.js app router pages
│   ├── api/                 # API routes
│   ├── pools/               # Pool-related pages
│   └── page.tsx             # Main dashboard
├── components/              # Reusable UI components
│   ├── dashboard/           # Dashboard-specific components
│   └── common/              # Shared components
├── hooks/                   # Custom React hooks
├── lib/                     # Utility functions and stores
├── prisma/                  # Database schema and migrations
├── public/                  # Static assets
├── styles/                  # Global styles
└── tests/                   # Test files
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or pnpm
- A Solana wallet (Phantom, Solflare, etc.)
- Access to a Solana devnet or mainnet endpoint

### Installation

1. Clone the repository
2. Navigate to the staking_client directory:
   ```bash
   cd staking_client
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
   or
   ```bash
   pnpm install
   ```
4. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your configuration values.

5. Run the development server:
   ```bash
   npm run dev
   ```
   or
   ```bash
   pnpm dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a `.env.local` file with the following variables:

```
NEXT_PUBLIC_SOLANA_RPC_URL=your_solana_rpc_url
NEXT_PUBLIC_PROGRAM_ID=your_staking_program_id
NEXT_PUBLIC_WS_ENDPOINT=your_websocket_endpoint
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by Solana blockchain
- UI components inspired by Radix UI
- Icons provided by Lucide