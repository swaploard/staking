import { useEffect, useState } from 'react'

export interface PositionData {
    id: string
    pool: string
    userAuthority: string
    shares: string
    unlockedShares: string
    depositAmount: string
    depositTime: string
    rewardDebt: string
    lastUpdatedSlot: string
    createdAt: Date
    updatedAt: Date
}

export interface PositionsResponse {
    positions: PositionData[]
    nextCursor: string | null
    hasMore: boolean
}

export interface UsePositionsOptions {
    limit?: number
    enabled?: boolean
}

export interface UsePositions extends PositionsResponse {
    loading: boolean
    error: Error | null
    fetchNextPage: () => Promise<void>
    refetch: () => Promise<void>
}

/**
 * Hook to fetch user positions for a specific wallet
 * Returns an empty list if pubkey is not provided or is undefined
 */
export function useUserPositions(
    pubkey: string | undefined,
    options: UsePositionsOptions = {}
): UsePositions {
    const { limit = 20, enabled = true } = options
    const [data, setData] = useState<PositionsResponse>({
        positions: [],
        nextCursor: null,
        hasMore: false,
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const fetchPositions = async (currentCursor?: string | null) => {
        if (!pubkey || !enabled) {
            return
        }

        try {
            setLoading(true)
            setError(null)

            const params = new URLSearchParams({
                limit: limit.toString(),
            })

            if (currentCursor) {
                params.append('cursor', currentCursor)
            }

            const response = await fetch(
                `/api/wallet/${encodeURIComponent(pubkey)}/positions?${params.toString()}`
            )

            if (!response.ok) {
                throw new Error(`Failed to fetch positions: ${response.statusText}`)
            }

            const positionsData: PositionsResponse = await response.json()
            setData(positionsData)
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

            const response = await fetch(
                `/api/wallet/${encodeURIComponent(pubkey!)}/positions?${params.toString()}`
            )

            if (!response.ok) {
                throw new Error(`Failed to fetch positions: ${response.statusText}`)
            }

            const newData: PositionsResponse = await response.json()
            setData({
                positions: [...data.positions, ...newData.positions],
                nextCursor: newData.nextCursor,
                hasMore: newData.hasMore,
            })
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (pubkey && enabled) {
            fetchPositions()
        } else {
            setData({ positions: [], nextCursor: null, hasMore: false })
        }
    }, [pubkey, limit, enabled])

    return {
        ...data,
        loading,
        error,
        fetchNextPage,
        refetch: () => fetchPositions(null),
    }
}
