import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Header } from '@/components/common/header'
import SolanaWalletProvider from "@/components/providers/wallet-provider"
import './globals.css'

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: 'Solana Staking Dashboard',
  description: 'Maximize your SOL rewards with strategic staking across multiple pools. Real-time reward accrual, low fees, and transparent APY.',
  generator: 'v0.app',
  keywords: ['Solana', 'Staking', 'DeFi', 'Cryptocurrency', 'SOL', 'Rewards'],
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#08090a' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased`}>
        <SolanaWalletProvider>
          <Header />
          {children}
          <Analytics />
        </SolanaWalletProvider>
      </body>
    </html>
  )
}
