import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { PublicKey } from '@solana/web3.js'

const prisma = new PrismaClient()

/**
 * GET /api/wallet/[pubkey]/positions
 *
 * Returns all staking positions for a given wallet.
 *
 * Path Parameters:
 * - pubkey: The wallet's public key
 *
 * Query Parameters:
 * - cursor: Optional cursor for pagination
 * - limit: Number of results per page (default: 20, max: 100)
 *
 * Response:
 * {
 *   positions: [{ id, pool, amount, rewardDebt, ... }],
 *   nextCursor: "cursor_for_next_page" | null,
 *   hasMore: boolean
 * }
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { pubkey: string } }
) {
    try {
        const { pubkey } = params
        const searchParams = request.nextUrl.searchParams

        const cursor = searchParams.get('cursor') || undefined
        let limit = parseInt(searchParams.get('limit') || '20', 10)

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
        let cursorPositionId: string | undefined = undefined
        if (cursor) {
            try {
                cursorPositionId = Buffer.from(cursor, 'base64').toString('utf-8')
            } catch {
                return NextResponse.json(
                    { error: 'Invalid cursor format' },
                    { status: 400 }
                )
            }
        }

        // Fetch user positions
        const positions = await prisma.userPosition.findMany({
            take: limit + 1,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursorPositionId! } : undefined,
            where: {
                userAuthority: pubkey,
            },
            orderBy: {
                id: 'asc',
            },
            select: {
                id: true,
                pool: true,
                userAuthority: true,
                shares: true,
                unlockedShares: true,
                depositAmount: true,
                depositTime: true,
                rewardDebt: true,
                lastUpdatedSlot: true,
                createdAt: true,
                updatedAt: true,
            },
        })

        // Check if there are more results
        const hasMore = positions.length > limit
        const resultPositions = hasMore ? positions.slice(0, limit) : positions

        // Generate next cursor
        let nextCursor: string | null = null
        if (hasMore && resultPositions.length > 0) {
            const lastPosition = resultPositions[resultPositions.length - 1]
            nextCursor = Buffer.from(lastPosition.id, 'utf-8').toString('base64')
        }

        // Serialize BigInt fields
        const serializedPositions = resultPositions.map((position: typeof resultPositions[number]) => ({
            ...position,
            shares: position.shares.toString(),
            unlockedShares: position.unlockedShares.toString(),
            depositAmount: position.depositAmount.toString(),
            depositTime: position.depositTime.toString(),
            rewardDebt: position.rewardDebt.toString(),
            lastUpdatedSlot: position.lastUpdatedSlot.toString(),
        }))

        // Set cache headers: short TTL for per-wallet data (user-specific, no aggressive caching)
        const headers = {
            'Cache-Control': 'private, max-age=2, stale-while-revalidate=5',
            'Content-Type': 'application/json',
        }

        return NextResponse.json(
            {
                positions: serializedPositions,
                nextCursor,
                hasMore,
            },
            { headers }
        )
    } catch (error) {
        console.error('Error fetching user positions:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
