'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, Copy, Info, AlertCircle, Loader, ExternalLink, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useWallet, useConnection, useAnchorWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { PublicKey } from '@solana/web3.js'
import { getProvider } from '@/lib/anchor'
import { createPool, derivePoolPdas } from '@/lib/instructions/create-pool'

// ─── helpers ────────────────────────────────────────────────────────────────

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

// ─── component ──────────────────────────────────────────────────────────────

export default function CreateStakingPool() {
    const { toast } = useToast()
    const { connected } = useWallet()
    const { connection } = useConnection()
    const anchorWallet = useAnchorWallet()

    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [txSig, setTxSig] = useState<string | null>(null)
    const [txError, setTxError] = useState<string | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        poolId: '',
        stakeTokenMint: '',
        rewardTokenMint: '',
        apr: '',
        lockDuration: '',
        cooldownDuration: '',
        depositCap: '',
    })

    // Validation errors
    const [errors, setErrors] = useState<Record<string, string>>({})

    // ── live PDA derivation ─────────────────────────────────────────────────
    const pdas = useMemo(() => {
        const id = formData.poolId !== '' ? Number(formData.poolId) : null
        if (id === null || !Number.isFinite(id) || id < 0) return null
        try {
            return derivePoolPdas(id)
        } catch {
            return null
        }
    }, [formData.poolId])

    // ── reset tx state on form change ───────────────────────────────────────
    useEffect(() => {
        setTxSig(null)
        setTxError(null)
    }, [formData])

    // ── handlers ────────────────────────────────────────────────────────────

    const handleInputChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }))
        if (errors[field]) {
            setErrors((prev) => {
                const next = { ...prev }
                delete next[field]
                return next
            })
        }
    }

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {}

        if (!formData.poolId || isNaN(Number(formData.poolId)) || Number(formData.poolId) < 0) {
            newErrors.poolId = 'Pool ID must be a non-negative integer'
        }
        if (!formData.stakeTokenMint) {
            newErrors.stakeTokenMint = 'Stake token mint is required'
        } else if (!isValidPublicKey(formData.stakeTokenMint)) {
            newErrors.stakeTokenMint = 'Invalid Solana public key'
        }
        if (!formData.rewardTokenMint) {
            newErrors.rewardTokenMint = 'Reward token mint is required'
        } else if (!isValidPublicKey(formData.rewardTokenMint)) {
            newErrors.rewardTokenMint = 'Invalid Solana public key'
        }
        if (!formData.apr) {
            newErrors.apr = 'APR is required'
        } else if (parseInt(formData.apr) > 10000 || parseInt(formData.apr) < 0) {
            newErrors.apr = 'APR must be between 0 and 10000 bps'
        }
        if (!formData.lockDuration || parseInt(formData.lockDuration) < 0) {
            newErrors.lockDuration = 'Lock duration must be >= 0'
        }
        if (!formData.cooldownDuration) {
            newErrors.cooldownDuration = 'Cooldown duration is required'
        } else if (parseInt(formData.cooldownDuration) <= 0) {
            newErrors.cooldownDuration = 'Cooldown must be > 0 seconds'
        }
        if (!formData.depositCap || parseInt(formData.depositCap) < 0) {
            newErrors.depositCap = 'Deposit cap must be >= 0'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleCreatePool = async () => {
        if (!connected || !anchorWallet) {
            toast({
                title: 'Wallet Not Connected',
                description: 'Connect your wallet using the button in the header',
                variant: 'destructive',
            })
            return
        }

        if (!validateForm()) return

        setIsSubmitting(true)
        setTxSig(null)
        setTxError(null)

        try {
            const provider = getProvider(connection, anchorWallet)

            const sig = await createPool(provider, {
                poolId: Number(formData.poolId),
                stakeMint: new PublicKey(formData.stakeTokenMint),
                rewardMint: new PublicKey(formData.rewardTokenMint),
                aprBps: Number(formData.apr),
                lockDuration: Number(formData.lockDuration),
                cooldownDuration: Number(formData.cooldownDuration),
                depositCap: Number(formData.depositCap),
            })

            setTxSig(sig)
            toast({
                title: '✅ Pool Created',
                description: `Transaction confirmed: ${truncate(sig, 6)}`,
            })
        } catch (err: unknown) {
            // Surface the Anchor/program error message cleanly
            let msg = 'Transaction failed'
            if (err instanceof Error) {
                // Anchor attaches logs to the error message — extract the most useful line
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

    const isFormReady =
        connected &&
        formData.poolId &&
        formData.stakeTokenMint &&
        formData.rewardTokenMint &&
        formData.apr &&
        formData.lockDuration !== '' &&
        formData.cooldownDuration &&
        formData.depositCap !== '';

    // ── render ───────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
            {/* Header */}
            <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
                <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
                    <h1 className="text-3xl font-bold tracking-tight text-white">Create Pool</h1>
                    <p className="mt-2 text-slate-400">Initialize a new staking pool (Admin only)</p>
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-4">

                {/* Wallet gate */}
                {!connected && (
                    <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>Connect your wallet to create a pool</span>
                        <WalletMultiButton className="ml-auto" />
                    </div>
                )}

                {/* Success banner */}
                {txSig && (
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                        <CheckCircle2 size={16} className="shrink-0" />
                        <span className="flex-1">
                            Pool created!{' '}
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

                {/* Error banner */}
                {txError && (
                    <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <p className="break-words">{txError}</p>
                    </div>
                )}

                {/* Form Card */}
                <Card className="border-slate-800 bg-slate-900 p-6 sm:p-8">
                    <h2 className="mb-6 text-xl font-semibold">Pool Configuration</h2>

                    <div className="space-y-6">
                        {/* Pool ID */}
                        <div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-slate-300">Pool ID</label>
                                <Tooltip text="Unique numeric identifier for this pool. Must not already exist on-chain." />
                            </div>
                            <Input
                                id="pool-id"
                                type="number"
                                min="0"
                                placeholder="0"
                                value={formData.poolId}
                                onChange={(e) => handleInputChange('poolId', e.target.value)}
                                className="mt-2 border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                            />
                            <FieldError msg={errors.poolId} />
                        </div>

                        {/* Stake Token Mint */}
                        <div>
                            <label className="text-sm font-medium text-slate-300">Stake Token Mint Address</label>
                            <Input
                                id="stake-mint"
                                type="text"
                                placeholder="Enter SPL token mint address"
                                value={formData.stakeTokenMint}
                                onChange={(e) => handleInputChange('stakeTokenMint', e.target.value)}
                                className="mt-2 border-slate-700 bg-slate-800 text-white placeholder-slate-500 font-mono text-sm"
                            />
                            <FieldError msg={errors.stakeTokenMint} />
                        </div>

                        {/* Reward Token Mint */}
                        <div>
                            <label className="text-sm font-medium text-slate-300">Reward Token Mint Address</label>
                            <Input
                                id="reward-mint"
                                type="text"
                                placeholder="Enter reward token mint address"
                                value={formData.rewardTokenMint}
                                onChange={(e) => handleInputChange('rewardTokenMint', e.target.value)}
                                className="mt-2 border-slate-700 bg-slate-800 text-white placeholder-slate-500 font-mono text-sm"
                            />
                            <FieldError msg={errors.rewardTokenMint} />
                        </div>

                        {/* APR */}
                        <div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-slate-300">APR (bps)</label>
                                <Tooltip text="Annual Percentage Rate in basis points. 100 bps = 1%. Max 10000 (100%)." />
                            </div>
                            <Input
                                id="apr"
                                type="number"
                                min="0"
                                max="10000"
                                placeholder="5000"
                                value={formData.apr}
                                onChange={(e) => handleInputChange('apr', e.target.value)}
                                className="mt-2 border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                            />
                            <p className="mt-1 text-xs text-slate-400">Max 10000 (100%)</p>
                            <FieldError msg={errors.apr} />
                        </div>

                        {/* Lock Duration */}
                        <div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-slate-300">Lock Duration (seconds)</label>
                                <Tooltip text="Time tokens are locked after staking before a user can request unstake. 0 = no lock." />
                            </div>
                            <Input
                                id="lock-duration"
                                type="number"
                                min="0"
                                placeholder="0"
                                value={formData.lockDuration}
                                onChange={(e) => handleInputChange('lockDuration', e.target.value)}
                                className="mt-2 border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                            />
                            <p className="mt-1 text-xs text-slate-400">0 = no lock</p>
                            <FieldError msg={errors.lockDuration} />
                        </div>

                        {/* Cooldown Duration */}
                        <div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-slate-300">Cooldown Duration (seconds)</label>
                                <Tooltip text="Time users must wait after request_unstake before they can withdraw. Must be > 0." />
                            </div>
                            <Input
                                id="cooldown-duration"
                                type="number"
                                min="1"
                                placeholder="3600"
                                value={formData.cooldownDuration}
                                onChange={(e) => handleInputChange('cooldownDuration', e.target.value)}
                                className="mt-2 border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                            />
                            <FieldError msg={errors.cooldownDuration} />
                        </div>

                        {/* Deposit Cap */}
                        <div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-slate-300">Deposit Cap (token units)</label>
                                <Tooltip text="Maximum total tokens that can be staked in this pool. 0 = no cap." />
                            </div>
                            <Input
                                id="deposit-cap"
                                type="number"
                                min="0"
                                placeholder="1000000"
                                value={formData.depositCap}
                                onChange={(e) => handleInputChange('depositCap', e.target.value)}
                                className="mt-2 border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                            />
                            <p className="mt-1 text-xs text-slate-400">0 = no cap</p>
                            <FieldError msg={errors.depositCap} />
                        </div>

                        {/* Submit */}
                        <Button
                            id="create-pool-btn"
                            onClick={handleCreatePool}
                            disabled={!isFormReady || isSubmitting}
                            className="mt-8 w-full bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader size={18} className="mr-2 animate-spin" />
                                    Sending Transaction…
                                </>
                            ) : (
                                'Create Pool'
                            )}
                        </Button>
                    </div>

                    {/* Advanced section */}
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
                                        <PdaRow label="Stake Vault PDA" address={pdas.stakeVault.toBase58()} onCopy={copyToClipboard} />
                                        <PdaRow label="Reward Vault PDA" address={pdas.rewardVault.toBase58()} onCopy={copyToClipboard} />
                                    </>
                                )}

                                {/* Config summary */}
                                {(formData.apr || formData.lockDuration || formData.cooldownDuration || formData.depositCap) && (
                                    <div className="rounded border border-slate-700 bg-slate-800/50 p-4">
                                        <p className="mb-3 text-sm font-medium text-slate-300">Configuration Summary</p>
                                        <div className="space-y-2 text-xs">
                                            {formData.apr && (
                                                <SummaryRow label="APR">
                                                    {formData.apr} bps ({(Number(formData.apr) / 100).toFixed(2)}%)
                                                </SummaryRow>
                                            )}
                                            {formData.lockDuration !== '' && (
                                                <SummaryRow label="Lock Duration">{formData.lockDuration}s</SummaryRow>
                                            )}
                                            {formData.cooldownDuration && (
                                                <SummaryRow label="Cooldown">{formData.cooldownDuration}s</SummaryRow>
                                            )}
                                            {formData.depositCap !== '' && (
                                                <SummaryRow label="Deposit Cap">
                                                    {formData.depositCap === '0' ? 'No cap' : formData.depositCap}
                                                </SummaryRow>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </Card>
            </main>
        </div>
    )
}

// ─── small sub-components ────────────────────────────────────────────────────

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

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex justify-between">
            <span className="text-slate-400">{label}:</span>
            <span className="text-slate-300">{children}</span>
        </div>
    )
}
