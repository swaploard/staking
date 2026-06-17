'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, Copy, Info, AlertCircle, Loader, ExternalLink, CheckCircle2, Shield, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useWallet, useConnection, useAnchorWallet } from '@solana/wallet-adapter-react'
import WalletButton from '@/components/wallet/wallet-button'
import { PublicKey } from '@solana/web3.js'
import { getProvider } from '@/lib/anchor'
import { derivePoolPdas } from '@/lib/instructions/fund-rewards'
import { pausePool, unpausePool } from '@/lib/instructions/pause-pool'

function isValidPublicKey(value: string): boolean {
    try {
        new PublicKey(value)
        return true
    } catch {
        return false
    }
}

function truncate(addr: string, chars = 8): string {
    if (addr.length <= chars * 2 + 3) return addr
    return `${addr.slice(0, chars)}...${addr.slice(-chars)}`
}

function solscanTxUrl(sig: string): string {
    const cluster = process.env.NEXT_PUBLIC_RPC_URL ? '' : '?cluster=devnet'
    return `https://solscan.io/tx/${sig}${cluster}`
}

export default function PausePool() {
    const { toast } = useToast()
    const { connected } = useWallet()
    const { connection } = useConnection()
    const anchorWallet = useAnchorWallet()

    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [txSig, setTxSig] = useState<string | null>(null)
    const [txError, setTxError] = useState<string | null>(null)

    const [poolId, setPoolId] = useState('')

    const [poolPaused, setPoolPaused] = useState<boolean | null>(null)
    const [poolFetchError, setPoolFetchError] = useState<string | null>(null)
    const [isFetchingPool, setIsFetchingPool] = useState(false)

    const [errors, setErrors] = useState<Record<string, string>>({})

    const pdas = useMemo(() => {
        const id = poolId !== '' ? Number(poolId) : null
        if (id === null || !Number.isFinite(id) || id < 0) return null
        try {
            return derivePoolPdas(id)
        } catch {
            return null
        }
    }, [poolId])

    useEffect(() => {
        setTxSig(null)
        setTxError(null)
        setPoolPaused(null)
        setPoolFetchError(null)
    }, [poolId])

    useEffect(() => {
        if (!pdas || !connection) return

        let cancelled = false
        setIsFetchingPool(true)
        setPoolFetchError(null)

        const fetchPool = async () => {
            try {
                const { getProgram } = await import('@/lib/anchor')
                const provider = getProvider(connection, {
                    publicKey: PublicKey.default,
                    signTransaction: async (tx) => tx,
                    signAllTransactions: async (txs) => txs,
                })
                const program = getProgram(provider)
                const poolAccount = await program.account.pool.fetch(pdas.pool)
                if (!cancelled) {
                    setPoolPaused(poolAccount.paused as boolean)
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    const msg = err instanceof Error ? err.message : 'Failed to fetch pool'
                    setPoolFetchError(msg)
                    setPoolPaused(null)
                }
            } finally {
                if (!cancelled) setIsFetchingPool(false)
            }
        }

        fetchPool()
        return () => { cancelled = true }
    }, [pdas, connection])

    const handlePoolIdChange = (value: string) => {
        setPoolId(value)
        if (errors.poolId) {
            setErrors((prev) => {
                const next = { ...prev }
                delete next.poolId
                return next
            })
        }
    }

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {}
        if (!poolId || isNaN(Number(poolId)) || Number(poolId) < 0) {
            newErrors.poolId = 'Pool ID must be a non-negative integer'
        }
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleTogglePause = async () => {
        if (!connected || !anchorWallet) {
            toast({
                title: 'Wallet Not Connected',
                description: 'Connect your wallet using the button in the header',
                variant: 'destructive',
            })
            return
        }

        if (!validateForm()) return
        if (poolPaused === null) return

        setIsSubmitting(true)
        setTxSig(null)
        setTxError(null)

        try {
            const provider = getProvider(connection, anchorWallet)

            const sig = poolPaused
                ? await unpausePool(provider, { poolId: Number(poolId) })
                : await pausePool(provider, { poolId: Number(poolId) })

            setTxSig(sig)
            setPoolPaused(!poolPaused)
            toast({
                title: poolPaused ? '✅ Pool Unpaused' : '✅ Pool Paused',
                description: `Transaction confirmed: ${truncate(sig, 6)}`,
            })
        } catch (err: unknown) {
            let msg = 'Transaction failed'
            if (err instanceof Error) {
                const lines = err.message.split('\n')
                const logLine = lines.find((l) => l.includes('Error') || l.includes('error'))
                msg = logLine ?? err.message
            }
            setTxError(msg)
            toast({
                title: 'Transaction Failed',
                description: msg,
                variant: 'destructive',
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast({ title: 'Copied', description: 'Address copied to clipboard' })
    }

    const isFormReady = connected && poolId && poolPaused !== null

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
            <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
                <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
                    <h1 className="text-3xl font-bold tracking-tight text-white">Pause Pool</h1>
                    <p className="mt-2 text-slate-400">Pause or unpause a staking pool (Admin or Pause Authority only)</p>
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-4">

                {!connected && (
                    <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>Connect your wallet to pause/unpause a pool</span>
                        <WalletButton className="ml-auto" />
                    </div>
                )}

                {txSig && (
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                        <CheckCircle2 size={16} className="shrink-0" />
                        <span className="flex-1">
                            Pool {poolPaused ? 'unpaused' : 'paused'}!{' '}
                            <span className="font-mono">{truncate(txSig, 8)}</span>
                        </span>
                        <a
                            href={solscanTxUrl(txSig)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 underline hover:text-emerald-200 transition-colors"
                        >
                            Solscan <ExternalLink size={12} />
                        </a>
                        <button
                            onClick={() => copyToClipboard(txSig)}
                            className="rounded p-1 hover:bg-emerald-500/20"
                            title="Copy signature"
                        >
                            <Copy size={14} />
                        </button>
                    </div>
                )}

                {txError && (
                    <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <p className="break-words">{txError}</p>
                    </div>
                )}

                <Card className="border-slate-800 bg-slate-900 p-6 sm:p-8">
                    <h2 className="mb-6 text-xl font-semibold">Pool Pause Control</h2>

                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-slate-300">Pool ID</label>
                                <Tooltip text="The numeric ID of the staking pool to pause or unpause." />
                            </div>
                            <Input
                                id="pool-id"
                                type="number"
                                min="0"
                                placeholder="0"
                                value={poolId}
                                onChange={(e) => handlePoolIdChange(e.target.value)}
                                className="mt-2 border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                            />
                            <FieldError msg={errors.poolId} />
                        </div>

                        {poolFetchError && (
                            <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                <p className="break-words">Could not load pool: {poolFetchError}</p>
                            </div>
                        )}

                        {pdas && poolPaused !== null && (
                            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {poolPaused ? (
                                            <ShieldOff size={24} className="text-red-400" />
                                        ) : (
                                            <Shield size={24} className="text-emerald-400" />
                                        )}
                                        <div>
                                            <p className="text-sm font-medium text-slate-300">
                                                Pool is currently{' '}
                                                <span className={poolPaused ? 'text-red-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                                                    {poolPaused ? 'PAUSED' : 'ACTIVE'}
                                                </span>
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {poolPaused
                                                    ? 'Staking, unstaking, and claiming are blocked.'
                                                    : 'All pool operations are enabled.'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-slate-400">
                                            {poolPaused ? 'Unpause' : 'Pause'}
                                        </span>
                                        <Switch
                                            checked={!poolPaused}
                                            onCheckedChange={handleTogglePause}
                                            disabled={!isFormReady || isSubmitting}
                                            className="data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-red-600"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {isFetchingPool && (
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <Loader size={16} className="animate-spin" />
                                Fetching pool state...
                            </div>
                        )}

                        {pdas && poolPaused === null && !isFetchingPool && !poolFetchError && (
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <Info size={16} />
                                Enter a valid Pool ID above to load pool state.
                            </div>
                        )}

                        {poolPaused !== null && (
                            <Button
                                id="toggle-pause-btn"
                                onClick={handleTogglePause}
                                disabled={!isFormReady || isSubmitting}
                                className={`mt-4 w-full transition-colors ${
                                    poolPaused
                                        ? 'bg-emerald-600 hover:bg-emerald-700'
                                        : 'bg-red-600 hover:bg-red-700'
                                } disabled:bg-slate-700 disabled:cursor-not-allowed`}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader size={18} className="mr-2 animate-spin" />
                                        Sending Transaction…
                                    </>
                                ) : poolPaused ? (
                                    'Unpause Pool'
                                ) : (
                                    'Pause Pool'
                                )}
                            </Button>
                        )}
                    </div>

                    <div className="mt-8 border-t border-slate-800 pt-8">
                        <button
                            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                            className="flex w-full items-center justify-between rounded p-3 hover:bg-slate-800 transition-colors"
                        >
                            <span className="font-medium text-slate-300">Advanced — Derived PDAs</span>
                            <ChevronDown
                                size={20}
                                className={`text-slate-400 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`}
                            />
                        </button>

                        {isAdvancedOpen && (
                            <div className="mt-4 space-y-4">
                                {!pdas ? (
                                    <p className="text-xs text-slate-500 px-3">
                                        Enter a valid Pool ID above to preview PDAs.
                                    </p>
                                ) : (
                                    <>
                                        <PdaRow label="Global Config PDA" address={pdas.globalConfig.toBase58()} onCopy={copyToClipboard} />
                                        <PdaRow label="Pool PDA" address={pdas.pool.toBase58()} onCopy={copyToClipboard} />
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </Card>
            </main>
        </div>
    )
}

function FieldError({ msg }: { msg?: string }) {
    if (!msg) return null
    return (
        <p className="mt-1 flex items-center gap-1 text-sm text-red-400">
            <AlertCircle size={14} /> {msg}
        </p>
    )
}

function PdaRow({ label, address, onCopy }: { label: string; address: string; onCopy: (s: string) => void }) {
    return (
        <div className="rounded border border-slate-700 bg-slate-800/50 p-3">
            <p className="text-xs text-slate-400">{label}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
                <code className="text-xs text-slate-300 break-all">{address}</code>
                <button
                    onClick={() => onCopy(address)}
                    className="shrink-0 rounded p-1 hover:bg-slate-700 transition-colors"
                    title="Copy address"
                >
                    <Copy size={14} className="text-slate-400" />
                </button>
            </div>
        </div>
    )
}

function Tooltip({ text }: { text: string }) {
    return (
        <div className="group relative">
            <Info size={14} className="cursor-help text-slate-500 hover:text-slate-300 transition-colors" />
            <div className="absolute bottom-full left-1/2 mb-2 hidden w-48 -translate-x-1/2 rounded bg-slate-800 border border-slate-700 p-2 text-xs text-slate-300 group-hover:block z-10 shadow-lg">
                {text}
            </div>
        </div>
    )
}
