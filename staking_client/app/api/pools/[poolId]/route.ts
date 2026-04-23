import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * GET /api/pools/[poolId]
 *
 * Returns detailed information about a specific pool + recent activity.
 *
 * Path Parameters:
 * - poolId: The public key of the pool
 *
 * Query Parameters:
 * - activityCursor: Optional cursor for pagination of recent activity
 * - activityLimit: Number of recent activity items to return (default: 10, max: 50)
 *
 * Response:
 * {
 *   pool: { id, authority, tokenMint, ... },
 *   recentActivity: [{ signature, eventType, amount, timestamp, ... }],
 *   activityNextCursor: "cursor_for_next_page" | null,
 *   activityHasMore: boolean
 * }
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ poolId: string }> }
) {
    try {
        const { poolId } = await params
        const searchParams = request.nextUrl.searchParams

        const activityCursor = searchParams.get('activityCursor') || undefined
        let activityLimit = parseInt(
            searchParams.get('activityLimit') || '10',
            10
        )

        // Validate and clamp activity limit
        if (isNaN(activityLimit) || activityLimit < 1) activityLimit = 10
        if (activityLimit > 50) activityLimit = 50

        // Fetch pool details
        const pool = await prisma.pool.findUnique({
            where: { id: poolId },
            select: {
                id: true,
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

        if (!pool) {
            return NextResponse.json(
                { error: 'Pool not found' },
                { status: 404 }
            )
        }

        // Parse activity cursor if provided
        let cursorId: bigint | undefined = undefined
        if (activityCursor) {
            try {
                cursorId = BigInt(Buffer.from(activityCursor, 'base64').toString('utf-8'))
            } catch {
                return NextResponse.json(
                    { error: 'Invalid cursor format' },
                    { status: 400 }
                )
            }
        }

        // Fetch recent activity for this pool
        const activity = await prisma.txActivity.findMany({
            take: activityLimit + 1,
            skip: activityCursor ? 1 : 0,
            cursor: cursorId ? { id: cursorId } : undefined,
            where: {
                poolId: poolId,
            },
            orderBy: {
                slot: 'desc',
            },
            select: {
                id: true,
                signature: true,
                slot: true,
                blockTime: true,
                ixIndex: true,
                eventType: true,
                userAuthority: true,
                amount: true,
                shares: true,
                status: true,
            },
        })

        const hasMore = activity.length > activityLimit
        const resultActivity = hasMore
            ? activity.slice(0, activityLimit)
            : activity

        // Generate next cursor
        let activityNextCursor: string | null = null
        if (hasMore && resultActivity.length > 0) {
            const lastActivity = resultActivity[resultActivity.length - 1]
            activityNextCursor = Buffer.from(lastActivity.id.toString(), 'utf-8').toString(
                'base64'
            )
        }

        // Serialize BigInt fields
        const serializedPool = {
            ...pool,
            stakedAmount: pool.stakedAmount.toString(),
            rewardAmount: pool.rewardAmount.toString(),
            rewardPerShare: pool.rewardPerShare.toString(),
            totalShares: pool.totalShares.toString(),
            lockUpPeriod: pool.lockUpPeriod.toString(),
            startTime: pool.startTime.toString(),
            lastUpdatedSlot: pool.lastUpdatedSlot.toString(),
        }

        const serializedActivity = resultActivity.map((item: typeof resultActivity[number]) => ({
            ...item,
            id: item.id.toString(),
            slot: item.slot.toString(),
            amount: item.amount ? item.amount.toString() : null,
            shares: item.shares ? item.shares.toString() : null,
        }))

        // Set cache headers: 5-second TTL for details (longer for activity)
        const headers = {
            'Cache-Control': 'public, max-age=5, stale-while-revalidate=15',
            'Content-Type': 'application/json',
        }

        return NextResponse.json(
            {
                pool: serializedPool,
                recentActivity: serializedActivity,
                activityNextCursor,
                activityHasMore: hasMore,
            },
            { headers }
        )
    } catch (error) {
        console.error('Error fetching pool details:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

/**
 * PATCH /api/pools/[poolId]
 * 
 * Updates off-chain pool metadata like name and description.
 * (In a production app, verify the request is signed by the pool authority)
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ poolId: string }> }
) {
    try {
        const { poolId } = await params
        const body = await request.json()
        const { name, description } = body

        // Only update provided fields
        const dataToUpdate: any = {}
        if (name !== undefined) dataToUpdate.name = name
        if (description !== undefined) dataToUpdate.description = description

        if (Object.keys(dataToUpdate).length === 0) {
            return NextResponse.json(
                { error: 'No fields to update provided' },
                { status: 400 }
            )
        }

        const updatedPool = await prisma.pool.update({
            where: { id: poolId },
            data: dataToUpdate,
            select: { id: true, name: true, description: true }
        })

        return NextResponse.json({ pool: updatedPool })
    } catch (error) {
        console.error('Error updating pool metadata:', error)
        return NextResponse.json(
            { error: 'Failed to update pool metadata' },
            { status: 500 }
        )
    }
}
