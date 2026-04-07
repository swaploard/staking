'use client'

import { useState } from 'react'
import { ChevronDown, Copy, Info, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export default function CreateStakingPool() {
    const { toast } = useToast()
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [walletConnected, setWalletConnected] = useState(false)
    const [walletAddress, setWalletAddress] = useState('')

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

    // Validation state
    const [errors, setErrors] = useState<Record<string, string>>({})

    // Derived PDAs (mock)
    const pdas = {
        pool: 'PoolPDAmLK9p5fxZz8gE3K2pQ1mN7bC9vH0jK3lM5nO7pQ9rS',
        stakeVault: 'StakeVaultAK9p5fxZz8gE3K2pQ1mN7bC9vH0jK3lM5nO7',
        rewardVault: 'RewardVaultK9p5fxZz8gE3K2pQ1mN7bC9vH0jK3lM5nO',
    }

    const handleInputChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }))
        // Clear error for this field
        if (errors[field]) {
            setErrors((prev) => {
                const newErrors = { ...prev }
                delete newErrors[field]
                return newErrors
            })
        }
    }

    const validateForm = () => {
        const newErrors: Record<string, string> = {}

        if (!formData.poolId) newErrors.poolId = 'Pool ID is required'
        if (!formData.stakeTokenMint) newErrors.stakeTokenMint = 'Stake token mint is required'
        if (!formData.rewardTokenMint) newErrors.rewardTokenMint = 'Reward token mint is required'
        if (!formData.apr) {
            newErrors.apr = 'APR is required'
        } else if (parseInt(formData.apr) > 10000) {
            newErrors.apr = 'APR cannot exceed 10000 (100%)'
        }
        if (!formData.lockDuration) newErrors.lockDuration = 'Lock duration is required'
        if (!formData.cooldownDuration) {
            newErrors.cooldownDuration = 'Cooldown duration is required'
        } else if (parseInt(formData.cooldownDuration) <= 0) {
            newErrors.cooldownDuration = 'Cooldown must be greater than 0'
        }
        if (!formData.depositCap) newErrors.depositCap = 'Deposit cap is required'

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleCreatePool = () => {
        if (!walletConnected) {
            toast({
                title: 'Wallet Not Connected',
                description: 'Please connect your wallet first',
                variant: 'destructive',
            })
            return
        }

        if (!validateForm()) return

        setIsSubmitting(true)
        // Simulate submission
        setTimeout(() => {
            setIsSubmitting(false)
            toast({
                title: 'Pool Created Successfully',
                description: 'Your staking pool has been initialized on Solana',
            })
        }, 2000)
    }

    const handleConnectWallet = () => {
        setWalletConnected(true)
        setWalletAddress('7qT9C2z5K9m2p1L8bH3vN4xK7wQ2rE5tY8uI1oP4sA')
        toast({
            title: 'Wallet Connected',
            description: 'Your Solana wallet is now connected',
        })
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast({
            title: 'Copied',
            description: 'Address copied to clipboard',
        })
    }

    const isFormValid =
        walletConnected &&
        formData.poolId &&
        formData.stakeTokenMint &&
        formData.rewardTokenMint &&
        formData.apr &&
        formData.lockDuration &&
        formData.cooldownDuration &&
        formData.depositCap

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
            {/* Header */}
            <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
                <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
                    <h1 className="text-3xl font-bold tracking-tight text-white">Create Pool</h1>
                    <p className="mt-2 text-slate-400">Initialize a new staking pool (Admin only)</p>
                </div>
            </header>

            {/* Main Content */}
            <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
                {/* Form Card */}
                <Card className="border-slate-800 bg-slate-900 p-6 sm:p-8">
                    <h2 className="mb-6 text-xl font-semibold">Pool Configuration</h2>

                    <div className="space-y-6">
                        {/* Pool ID */}
                        <div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-slate-300">Pool ID</label>
                                <div className="group relative">
                                    <Info size={16} className="cursor-help text-slate-400" />
                                    <div className="absolute bottom-full left-1/2 mb-2 hidden w-32 -translate-x-1/2 rounded bg-slate-800 p-2 text-xs text-slate-300 group-hover:block">
                                        Unique identifier for the pool
                                    </div>
                                </div>
                            </div>
                            <Input
                                type="number"
                                placeholder="0"
                                value={formData.poolId}
                                onChange={(e) => handleInputChange('poolId', e.target.value)}
                                className="mt-2 border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                            />
                            {errors.poolId && (
                                <p className="mt-1 flex items-center gap-1 text-sm text-red-400">
                                    <AlertCircle size={14} /> {errors.poolId}
                                </p>
                            )}
                        </div>

                        {/* Stake Token Mint */}
                        <div>
                            <label className="text-sm font-medium text-slate-300">Stake Token Mint Address</label>
                            <Input
                                type="text"
                                placeholder="Enter SPL token mint address"
                                value={formData.stakeTokenMint}
                                onChange={(e) => handleInputChange('stakeTokenMint', e.target.value)}
                                className="mt-2 border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                            />
                            {errors.stakeTokenMint && (
                                <p className="mt-1 flex items-center gap-1 text-sm text-red-400">
                                    <AlertCircle size={14} /> {errors.stakeTokenMint}
                                </p>
                            )}
                        </div>

                        {/* Reward Token Mint */}
                        <div>
                            <label className="text-sm font-medium text-slate-300">Reward Token Mint Address</label>
                            <Input
                                type="text"
                                placeholder="Enter reward token mint address"
                                value={formData.rewardTokenMint}
                                onChange={(e) => handleInputChange('rewardTokenMint', e.target.value)}
                                className="mt-2 border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                            />
                            {errors.rewardTokenMint && (
                                <p className="mt-1 flex items-center gap-1 text-sm text-red-400">
                                    <AlertCircle size={14} /> {errors.rewardTokenMint}
                                </p>
                            )}
                        </div>

                        {/* APR */}
                        <div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-slate-300">APR (bps)</label>
                                <div className="group relative">
                                    <Info size={16} className="cursor-help text-slate-400" />
                                    <div className="absolute bottom-full left-1/2 mb-2 hidden w-40 -translate-x-1/2 rounded bg-slate-800 p-2 text-xs text-slate-300 group-hover:block">
                                        Annual Percentage Rate in basis points. Max 10000 (100%)
                                    </div>
                                </div>
                            </div>
                            <Input
                                type="number"
                                placeholder="5000"
                                value={formData.apr}
                                onChange={(e) => handleInputChange('apr', e.target.value)}
                                className="mt-2 border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                            />
                            <p className="mt-1 text-xs text-slate-400">Max 10000 (100%)</p>
                            {errors.apr && (
                                <p className="mt-1 flex items-center gap-1 text-sm text-red-400">
                                    <AlertCircle size={14} /> {errors.apr}
                                </p>
                            )}
                        </div>

                        {/* Lock Duration */}
                        <div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-slate-300">Lock Duration (seconds)</label>
                                <div className="group relative">
                                    <Info size={16} className="cursor-help text-slate-400" />
                                    <div className="absolute bottom-full left-1/2 mb-2 hidden w-40 -translate-x-1/2 rounded bg-slate-800 p-2 text-xs text-slate-300 group-hover:block">
                                        Time your tokens are locked after staking. 0 = no lock
                                    </div>
                                </div>
                            </div>
                            <Input
                                type="number"
                                placeholder="0"
                                value={formData.lockDuration}
                                onChange={(e) => handleInputChange('lockDuration', e.target.value)}
                                className="mt-2 border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                            />
                            <p className="mt-1 text-xs text-slate-400">0 = no lock</p>
                            {errors.lockDuration && (
                                <p className="mt-1 flex items-center gap-1 text-sm text-red-400">
                                    <AlertCircle size={14} /> {errors.lockDuration}
                                </p>
                            )}
                        </div>

                        {/* Cooldown Duration */}
                        <div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-slate-300">Cooldown Duration (seconds)</label>
                                <div className="group relative">
                                    <Info size={16} className="cursor-help text-slate-400" />
                                    <div className="absolute bottom-full left-1/2 mb-2 hidden w-40 -translate-x-1/2 rounded bg-slate-800 p-2 text-xs text-slate-300 group-hover:block">
                                        Time before withdrawal after unstake action
                                    </div>
                                </div>
                            </div>
                            <Input
                                type="number"
                                placeholder="3600"
                                value={formData.cooldownDuration}
                                onChange={(e) => handleInputChange('cooldownDuration', e.target.value)}
                                className="mt-2 border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                            />
                            {errors.cooldownDuration && (
                                <p className="mt-1 flex items-center gap-1 text-sm text-red-400">
                                    <AlertCircle size={14} /> {errors.cooldownDuration}
                                </p>
                            )}
                        </div>

                        {/* Deposit Cap */}
                        <div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-slate-300">Deposit Cap</label>
                                <div className="group relative">
                                    <Info size={16} className="cursor-help text-slate-400" />
                                    <div className="absolute bottom-full left-1/2 mb-2 hidden w-40 -translate-x-1/2 rounded bg-slate-800 p-2 text-xs text-slate-300 group-hover:block">
                                        Maximum total tokens allowed in this pool
                                    </div>
                                </div>
                            </div>
                            <Input
                                type="number"
                                placeholder="1000000"
                                value={formData.depositCap}
                                onChange={(e) => handleInputChange('depositCap', e.target.value)}
                                className="mt-2 border-slate-700 bg-slate-800 text-white placeholder-slate-500"
                            />
                            {errors.depositCap && (
                                <p className="mt-1 flex items-center gap-1 text-sm text-red-400">
                                    <AlertCircle size={14} /> {errors.depositCap}
                                </p>
                            )}
                        </div>

                        {/* Create Pool Button */}
                        <Button
                            onClick={handleCreatePool}
                            disabled={!isFormValid || isSubmitting}
                            className="mt-8 w-full bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader size={18} className="mr-2 animate-spin" />
                                    Creating Pool...
                                </>
                            ) : (
                                'Create Pool'
                            )}
                        </Button>
                    </div>

                    {/* Advanced Section */}
                    <div className="mt-8 border-t border-slate-800 pt-8">
                        <button
                            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                            className="flex w-full items-center justify-between rounded p-3 hover:bg-slate-800"
                        >
                            <span className="font-medium text-slate-300">Advanced</span>
                            <ChevronDown
                                size={20}
                                className={`text-slate-400 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''
                                    }`}
                            />
                        </button>

                        {isAdvancedOpen && (
                            <div className="mt-4 space-y-4">
                                <div>
                                    <p className="mb-3 text-sm font-medium text-slate-300">Derived PDA Addresses</p>
                                    <div className="space-y-3">
                                        {/* Pool PDA */}
                                        <div className="rounded border border-slate-700 bg-slate-800/50 p-3">
                                            <p className="text-xs text-slate-400">Pool PDA</p>
                                            <div className="mt-2 flex items-center justify-between">
                                                <code className="text-xs text-slate-300">{pdas.pool}</code>
                                                <button
                                                    onClick={() => copyToClipboard(pdas.pool)}
                                                    className="rounded p-1 hover:bg-slate-700"
                                                >
                                                    <Copy size={14} className="text-slate-400" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Stake Vault PDA */}
                                        <div className="rounded border border-slate-700 bg-slate-800/50 p-3">
                                            <p className="text-xs text-slate-400">Stake Vault PDA</p>
                                            <div className="mt-2 flex items-center justify-between">
                                                <code className="text-xs text-slate-300">{pdas.stakeVault}</code>
                                                <button
                                                    onClick={() => copyToClipboard(pdas.stakeVault)}
                                                    className="rounded p-1 hover:bg-slate-700"
                                                >
                                                    <Copy size={14} className="text-slate-400" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Reward Vault PDA */}
                                        <div className="rounded border border-slate-700 bg-slate-800/50 p-3">
                                            <p className="text-xs text-slate-400">Reward Vault PDA</p>
                                            <div className="mt-2 flex items-center justify-between">
                                                <code className="text-xs text-slate-300">{pdas.rewardVault}</code>
                                                <button
                                                    onClick={() => copyToClipboard(pdas.rewardVault)}
                                                    className="rounded p-1 hover:bg-slate-700"
                                                >
                                                    <Copy size={14} className="text-slate-400" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Pool Configuration Summary */}
                                <div className="rounded border border-slate-700 bg-slate-800/50 p-4">
                                    <p className="mb-3 text-sm font-medium text-slate-300">Configuration Summary</p>
                                    <div className="space-y-2 text-xs">
                                        {formData.apr && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">APR:</span>
                                                <span className="text-slate-300">{formData.apr} bps</span>
                                            </div>
                                        )}
                                        {formData.lockDuration && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Lock Duration:</span>
                                                <span className="text-slate-300">{formData.lockDuration}s</span>
                                            </div>
                                        )}
                                        {formData.cooldownDuration && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Cooldown:</span>
                                                <span className="text-slate-300">{formData.cooldownDuration}s</span>
                                            </div>
                                        )}
                                        {formData.depositCap && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Deposit Cap:</span>
                                                <span className="text-slate-300">{formData.depositCap}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            </main>
        </div>
    )
}
