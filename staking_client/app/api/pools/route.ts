import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function extractAprBpsFromMetadata(metadata: unknown): bigint | null {
    if (!metadata || typeof metadata !== 'object') return null
    const record = metadata as Record<string, unknown>
    const candidates = [
        record.aprBps,
        record.apr_bps,
        record.apr,
        record.params && typeof record.params === 'object'
            ? (record.params as Record<string, unknown>).aprBps
            : undefined,
        record.params && typeof record.params === 'object'
            ? (record.params as Record<string, unknown>).apr_bps
            : undefined,
    ]

    for (const value of candidates) {
        if (value === null || value === undefined) continue
        try {
            return BigInt(String(value))
        } catch {
            // keep scanning candidates
        }
    }
    return null
}

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
        const baseQuery = {
            take: limit + 1, // Fetch one extra to determine if there are more results
            skip: cursor ? 1 : 0, // Skip the cursor itself if provided
            cursor: cursor ? { id: cursorPoolId! } : undefined,
            orderBy: {
                id: 'asc' as const,
            },
        }

        let pools: Array<any>
        try {
            pools = await prisma.pool.findMany({
                ...baseQuery,
                select: {
                    id: true,
                    poolId: true,
                    name: true,
                    description: true,
                    authority: true,
                    tokenMint: true,
                    rewardMint: true,
                    aprBps: true,
                    createdTxHash: true,
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
            } as any)
        } catch (error) {
            const message = error instanceof Error ? error.message : ''
            const missingAprField =
                message.includes('Unknown field `aprBps`') ||
                message.includes('Unknown argument `aprBps`')
            if (!missingAprField) {
                throw error
            }

            // Compatibility fallback for stale Prisma clients.
            pools = await prisma.pool.findMany({
                ...baseQuery,
                select: {
                    id: true,
                    poolId: true,
                    name: true,
                    description: true,
                    authority: true,
                    tokenMint: true,
                    rewardMint: true,
                    createdTxHash: true,
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
        }

        // Check if there are more results
        const hasMore = pools.length > limit
        const resultPools = hasMore ? pools.slice(0, limit) : pools

        const poolIdsNeedingApr = resultPools
            .filter((pool) => {
                const aprBpsValue = pool.aprBps ? Number(pool.aprBps) : 0
                return aprBpsValue === 0
            })
            .map((pool) => pool.id)

        const aprBpsFallbackByPoolId = new Map<string, bigint>()
        if (poolIdsNeedingApr.length > 0) {
            const creationActivity = await prisma.txActivity.findMany({
                where: {
                    poolId: { in: poolIdsNeedingApr },
                    eventType: { in: ['PoolCreated', 'CreatePool'] },
                },
                orderBy: [{ slot: 'asc' }, { ixIndex: 'asc' }],
                select: {
                    poolId: true,
                    metadata: true,
                },
            })

            for (const row of creationActivity) {
                if (!row.poolId || aprBpsFallbackByPoolId.has(row.poolId)) continue

                const aprBps = extractAprBpsFromMetadata(row.metadata)
                if (aprBps !== null) aprBpsFallbackByPoolId.set(row.poolId, aprBps)
            }

            const txHashesNeedingApr = resultPools
                .filter((pool) => !aprBpsFallbackByPoolId.has(pool.id) && pool.createdTxHash)
                .map((pool) => pool.createdTxHash as string)

            if (txHashesNeedingApr.length > 0) {
                const signatureActivities = await prisma.txActivity.findMany({
                    where: {
                        signature: { in: txHashesNeedingApr },
                        eventType: { in: ['PoolCreated', 'CreatePool'] },
                    },
                    orderBy: [{ slot: 'asc' }, { ixIndex: 'asc' }],
                    select: {
                        signature: true,
                        metadata: true,
                    },
                })

                const aprBySignature = new Map<string, bigint>()
                for (const row of signatureActivities) {
                    if (aprBySignature.has(row.signature)) continue
                    const aprBps = extractAprBpsFromMetadata(row.metadata)
                    if (aprBps !== null) aprBySignature.set(row.signature, aprBps)
                }

                for (const pool of resultPools) {
                    if (aprBpsFallbackByPoolId.has(pool.id) || !pool.createdTxHash) continue
                    const aprBps = aprBySignature.get(pool.createdTxHash)
                    if (aprBps !== undefined) {
                        aprBpsFallbackByPoolId.set(pool.id, aprBps)
                    }
                }
            }
        }

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
            aprBps: (
                pool.aprBps && Number(pool.aprBps) > 0
                    ? pool.aprBps
                    : aprBpsFallbackByPoolId.get(pool.id) ?? 0n
            ).toString(),
            apy: Number(
                pool.aprBps && Number(pool.aprBps) > 0
                    ? pool.aprBps
                    : aprBpsFallbackByPoolId.get(pool.id) ?? 0n
            ) / 100,
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
