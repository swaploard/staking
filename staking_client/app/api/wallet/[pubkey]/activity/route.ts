import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { PublicKey } from '@solana/web3.js'

const prisma = new PrismaClient()

/**
 * GET /api/wallet/[pubkey]/activity
 *
 * Returns transaction activity history for a given wallet.
 * Uses cursor-based pagination ordered by slot DESC (newest first).
 *
 * Path Parameters:
 * - pubkey: The wallet's public key
 *
 * Query Parameters:
 * - cursor: Optional cursor for pagination
 * - limit: Number of results per page (default: 20, max: 100)
 * - days: Filter to last N days (default: 30, optional)
 *
 * Response:
 * {
 *   activity: [{ signature, eventType, amount, slot, blockTime, status, ... }],
 *   nextCursor: "cursor_for_next_page" | null,
 *   hasMore: boolean
 * }
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ pubkey: string }> }
) {
    try {
        const { pubkey } = await params
        const searchParams = request.nextUrl.searchParams

        const cursor = searchParams.get('cursor') || undefined
        let limit = parseInt(searchParams.get('limit') || '20', 10)
        const days = parseInt(searchParams.get('days') || '30', 10)

        // Validate limit
        if (isNaN(limit) || limit < 1) limit = 20
        if (limit > 100) limit = 100

        // Validate pubkey format
        try {
            new PublicKey(pubkey)
        } catch {
            return NextResponse.json(
                { error: 'Invalid public key format' },
                { status: 400 }
            )
        }

        // Parse cursor if provided
        // Cursor format: base64(activity_id)
        let cursorActivityId: bigint | undefined = undefined
        if (cursor) {
            try {
                cursorActivityId = BigInt(
                    Buffer.from(cursor, 'base64').toString('utf-8')
                )
            } catch {
                return NextResponse.json(
                    { error: 'Invalid cursor format' },
                    { status: 400 }
                )
            }
        }

        // Calculate time range filter (safety: default to last 30 days)
        const timeFilterDays = isNaN(days) || days < 0 ? 30 : Math.min(days, 90)
        const since = new Date()
        since.setDate(since.getDate() - timeFilterDays)

        // Fetch activity for user
        const activity = await prisma.txActivity.findMany({
            take: limit + 1,
            skip: cursor ? 1 : 0,
            cursor: cursorActivityId ? { id: cursorActivityId } : undefined,
            where: {
                userAuthority: pubkey,
                blockTime: {
                    gte: since, // Only last N days
                },
            },
            orderBy: [
                {
                    slot: 'desc', // Newest slots first
                },
                {
                    signature: 'desc', // Secondary sort by signature
                },
                {
                    ixIndex: 'desc', // Tertiary sort by instruction index
                },
            ],
            select: {
                id: true,
                signature: true,
                slot: true,
                blockTime: true,
                ixIndex: true,
                eventType: true,
                eventVersion: true,
                poolId: true,
                userAuthority: true,
                amount: true,
                shares: true,
                timestamp: true,
                status: true,
            },
        })

        // Check if there are more results
        const hasMore = activity.length > limit
        const resultActivity = hasMore ? activity.slice(0, limit) : activity

        // Generate next cursor
        let nextCursor: string | null = null
        if (hasMore && resultActivity.length > 0) {
            const lastActivity = resultActivity[resultActivity.length - 1]
            nextCursor = Buffer.from(lastActivity.id.toString(), 'utf-8').toString(
                'base64'
            )
        }

        // Serialize BigInt and other fields
        const serializedActivity = resultActivity.map((item: typeof resultActivity[number]) => ({
            ...item,
            id: item.id.toString(),
            slot: item.slot.toString(),
            amount: item.amount ? item.amount.toString() : null,
            shares: item.shares ? item.shares.toString() : null,
            timestamp: item.timestamp ? item.timestamp.toString() : null,
        }))

        // Set cache headers: very short TTL for activity (user-specific, real-time data)
        const headers = {
            'Cache-Control': 'private, max-age=1, stale-while-revalidate=3',
            'Content-Type': 'application/json',
        }

        return NextResponse.json(
            {
                activity: serializedActivity,
                nextCursor,
                hasMore,
                timeFilterDays,
            },
            { headers }
        )
    } catch (error) {
        console.error('Error fetching wallet activity:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
