import { useEffect, useState } from 'react'

export interface PoolData {
    id: string
    authority: string
    tokenMint: string
    vaultBump: number
    stakedAmount: string
    rewardAmount: string
    rewardPerShare: string
    totalShares: string
    lockUpPeriod: string
    startTime: string
    endTime: string | null
    lastUpdatedSlot: string
    createdAt: Date
    updatedAt: Date
}

export interface PoolsResponse {
    pools: PoolData[]
    nextCursor: string | null
    hasMore: boolean
}

export interface UsePaginationOptions {
    limit?: number
}

export interface UsePools extends PoolsResponse {
    loading: boolean
    error: Error | null
    fetchNextPage: () => Promise<void>
    refetch: () => Promise<void>
}

/**
 * Hook to fetch pools with cursor-based pagination
 */
export function usePools(options: UsePaginationOptions = {}): UsePools {
    const { limit = 20 } = options
    const [data, setData] = useState<PoolsResponse>({
        pools: [],
        nextCursor: null,
        hasMore: false,
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)
    const [cursor, setCursor] = useState<string | null>(null)

    const fetchPools = async (currentCursor?: string | null) => {
        try {
            setLoading(true)
            setError(null)

            const params = new URLSearchParams({
                limit: limit.toString(),
            })

            if (currentCursor) {
                params.append('cursor', currentCursor)
            }

            const response = await fetch(`/api/pools?${params.toString()}`)
            if (!response.ok) {
                throw new Error(`Failed to fetch pools: ${response.statusText}`)
            }

            const poolsData: PoolsResponse = await response.json()
            setData(poolsData)
            setCursor(poolsData.nextCursor)
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'))
        } finally {
            setLoading(false)
        }
    }

    const fetchNextPage = async () => {
        if (!data.hasMore || !data.nextCursor) {
            return
        }

        try {
            setLoading(true)
            const params = new URLSearchParams({
                limit: limit.toString(),
                cursor: data.nextCursor,
            })

            const response = await fetch(`/api/pools?${params.toString()}`)
            if (!response.ok) {
                throw new Error(`Failed to fetch pools: ${response.statusText}`)
            }

            const newData: PoolsResponse = await response.json()
            setData({
                pools: [...data.pools, ...newData.pools],
                nextCursor: newData.nextCursor,
                hasMore: newData.hasMore,
            })
            setCursor(newData.nextCursor)
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPools()
    }, [limit])

    return {
        ...data,
        loading,
        error,
        fetchNextPage,
        refetch: () => fetchPools(null),
    }
}
