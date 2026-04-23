import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * GET /api/pools
 *
 * Returns a paginated list of all staking pools with cursor-based pagination.
 *
 * Query Parameters:
 * - cursor: Optional opaque cursor from previous response (for pagination)
 * - limit: Number of results per page (default: 20, max: 100)
 *
 * Response:
 * {
 *   pools: [{ id, authority, tokenMint, ... }],
 *   nextCursor: "cursor_for_next_page" | null,
 *   hasMore: boolean
 * }
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const cursor = searchParams.get('cursor') || undefined
        let limit = parseInt(searchParams.get('limit') || '20', 10)

        // Validate and clamp limit
        if (isNaN(limit) || limit < 1) limit = 20
        if (limit > 100) limit = 100

        // Parse cursor if provided
        // Cursor format: base64(pool_id)
        let cursorPoolId: string | undefined = undefined
        if (cursor) {
            try {
                cursorPoolId = Buffer.from(cursor, 'base64').toString('utf-8')
            } catch {
                return NextResponse.json(
                    { error: 'Invalid cursor format' },
                    { status: 400 }
                )
            }
        }

        // Fetch pools with pagination
        // Order by id (pool address) for consistent ordering
        const pools = await prisma.pool.findMany({
            take: limit + 1, // Fetch one extra to determine if there are more results
            skip: cursor ? 1 : 0, // Skip the cursor itself if provided
            cursor: cursor ? { id: cursorPoolId! } : undefined,
            orderBy: {
                id: 'asc',
            },
            select: {
                id: true,
                poolId: true,
                name: true,
                description: true,
                authority: true,
                tokenMint: true,
                rewardMint: true,
                vaultBump: true,
                stakedAmount: true,
                rewardAmount: true,
                rewardPerShare: true,
                totalShares: true,
                lockUpPeriod: true,
                startTime: true,
                endTime: true,
                lastUpdatedSlot: true,
                createdAt: true,
                updatedAt: true,
            },
        })

        // Check if there are more results
        const hasMore = pools.length > limit
        const resultPools = hasMore ? pools.slice(0, limit) : pools

        // Generate next cursor (base64 encoded last pool id)
        let nextCursor: string | null = null
        if (hasMore && resultPools.length > 0) {
            const lastPool = resultPools[resultPools.length - 1]
            nextCursor = Buffer.from(lastPool.id, 'utf-8').toString('base64')
        }

        // Convert BigInt fields to strings for JSON serialization
        const serializedPools = resultPools.map((pool: typeof resultPools[number]) => ({
            ...pool,
            poolId: pool.poolId,
            stakedAmount: pool.stakedAmount.toString(),
            rewardAmount: pool.rewardAmount.toString(),
            rewardPerShare: pool.rewardPerShare.toString(),
            totalShares: pool.totalShares.toString(),
            lockUpPeriod: pool.lockUpPeriod.toString(),
            startTime: pool.startTime.toString(),
            endTime: pool.endTime?.toString(),
            lastUpdatedSlot: pool.lastUpdatedSlot.toString(),
        }))

        // Set cache headers: 5-second TTL for list endpoints
        const headers = {
            'Cache-Control': 'public, max-age=5, stale-while-revalidate=10',
            'Content-Type': 'application/json',
        }

        return NextResponse.json(
            {
                pools: serializedPools,
                nextCursor,
                hasMore,
            },
            { headers }
        )
    } catch (error) {
        console.error('Error fetching pools:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
