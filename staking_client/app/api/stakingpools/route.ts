import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type PoolRow = {
    id: string
    poolId: number | null
    authority: string
    tokenMint: string
    rewardMint: string
    vaultBump: number
    stakedAmount: bigint
    rewardAmount: bigint
    rewardPerShare: bigint
    totalShares: bigint
    lockUpPeriod: bigint
    startTime: bigint
    endTime: bigint | null
    lastUpdatedSlot: bigint
    createdAt: Date
    updatedAt: Date
    name: string
    description: string
}

type PoolMetadata = {
    id: string
    name: string
    description: string
    aprBps?: bigint | null
    createdTxHash?: string | null
}

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

async function getPoolMetadataById(poolIds: string[]) {
    if (poolIds.length === 0) return new Map<string, PoolMetadata>()

    let rows: PoolMetadata[]
    try {
        rows = await prisma.pool.findMany({
            where: { id: { in: poolIds } },
            select: {
                id: true,
                name: true,
                description: true,
                aprBps: true,
                createdTxHash: true,
            },
        } as any)
    } catch (error) {
        const message = error instanceof Error ? error.message : ''
        const missingAprField =
            message.includes('Unknown field `aprBps`') ||
            message.includes('Unknown argument `aprBps`')
        if (!missingAprField) throw error

        rows = await prisma.pool.findMany({
            where: { id: { in: poolIds } },
            select: {
                id: true,
                name: true,
                description: true,
                createdTxHash: true,
            },
        }) as PoolMetadata[]
    }

    return new Map(rows.map((row) => [row.id, row]))
}

async function getAprFallbacks(poolRows: PoolRow[], metadataById: Map<string, PoolMetadata>) {
    const poolIdsNeedingApr = poolRows
        .filter((pool) => {
            const metadata = metadataById.get(pool.id)
            return !metadata?.aprBps || Number(metadata.aprBps) === 0
        })
        .map((pool) => pool.id)

    const aprBpsFallbackByPoolId = new Map<string, bigint>()
    if (poolIdsNeedingApr.length === 0) return aprBpsFallbackByPoolId

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

    const txHashesNeedingApr = poolRows
        .filter((pool) => {
            const metadata = metadataById.get(pool.id)
            return !aprBpsFallbackByPoolId.has(pool.id) && metadata?.createdTxHash
        })
        .map((pool) => metadataById.get(pool.id)?.createdTxHash as string)

    if (txHashesNeedingApr.length === 0) return aprBpsFallbackByPoolId

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

    for (const pool of poolRows) {
        const createdTxHash = metadataById.get(pool.id)?.createdTxHash
        if (aprBpsFallbackByPoolId.has(pool.id) || !createdTxHash) continue
        const aprBps = aprBySignature.get(createdTxHash)
        if (aprBps !== undefined) {
            aprBpsFallbackByPoolId.set(pool.id, aprBps)
        }
    }

    return aprBpsFallbackByPoolId
}

async function serializePools(poolRows: PoolRow[]) {
    const metadataById = await getPoolMetadataById(poolRows.map((pool) => pool.id))
    const aprBpsFallbackByPoolId = await getAprFallbacks(poolRows, metadataById)

    return poolRows.map((pool) => {
        const metadata = metadataById.get(pool.id)
        const effectiveAprBps =
            metadata?.aprBps && Number(metadata.aprBps) > 0
                ? metadata.aprBps
                : aprBpsFallbackByPoolId.get(pool.id) ?? 0n

        return {
            ...pool,
            name: metadata?.name ?? pool.name ?? '',
            description: metadata?.description ?? pool.description ?? '',
            aprBps: effectiveAprBps.toString(),
            apy: Number(effectiveAprBps) / 100,
            stakedAmount: pool.stakedAmount.toString(),
            rewardAmount: pool.rewardAmount.toString(),
            rewardPerShare: pool.rewardPerShare.toString(),
            totalShares: pool.totalShares.toString(),
            lockUpPeriod: pool.lockUpPeriod.toString(),
            startTime: pool.startTime.toString(),
            endTime: pool.endTime?.toString(),
            lastUpdatedSlot: pool.lastUpdatedSlot.toString(),
        }
    })
}

function parsePoolIds(value: unknown): string[] | null {
    if (!Array.isArray(value)) return null

    const seen = new Set<string>()
    for (const item of value) {
        if (typeof item !== 'string' || item.trim() === '') return null
        seen.add(item.trim())
    }

    return [...seen]
}

export async function GET() {
    try {
        const selectedPools = await prisma.stakingpool.findMany({
            orderBy: {
                id: 'asc',
            },
        })

        const sourcePools = await prisma.pool.findMany({
            where: {
                id: { in: selectedPools.map((pool) => pool.id) },
            },
            select: {
                id: true,
                poolId: true,
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
                name: true,
                description: true,
            },
        })
        const sourcePoolById = new Map(sourcePools.map((pool) => [pool.id, pool]))
        const hydratedPools = selectedPools.map((pool) => sourcePoolById.get(pool.id) ?? pool)
        const serializedPools = await serializePools(hydratedPools)

        return NextResponse.json(
            {
                pools: serializedPools,
                ids: serializedPools.map((pool) => pool.id),
            },
            {
                headers: {
                    'Cache-Control': 'no-store',
                    'Content-Type': 'application/json',
                },
            }
        )
    } catch (error) {
        console.error('Error fetching selected staking pools:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const poolIds = parsePoolIds(body.poolIds)

        if (!poolIds) {
            return NextResponse.json(
                { error: 'poolIds must be an array of pool id strings' },
                { status: 400 }
            )
        }

        const sourcePools = await prisma.pool.findMany({
            where: { id: { in: poolIds } },
            select: {
                id: true,
                poolId: true,
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
                name: true,
                description: true,
            },
        })

        const foundPoolIds = new Set(sourcePools.map((pool) => pool.id))
        const missingPoolIds = poolIds.filter((poolId) => !foundPoolIds.has(poolId))
        if (missingPoolIds.length > 0) {
            return NextResponse.json(
                {
                    error: 'Some pools were not found',
                    missingPoolIds,
                },
                { status: 404 }
            )
        }

        await prisma.$transaction([
            prisma.stakingpool.deleteMany({
                where: poolIds.length > 0 ? { id: { notIn: poolIds } } : {},
            }),
             ...sourcePools.map((pool) =>
                 prisma.stakingpool.upsert({
                     where: { id: pool.id },
                     create: pool,
                     update: {
                         poolId: pool.poolId,
                         authority: pool.authority,
                         tokenMint: pool.tokenMint,
                         rewardMint: pool.rewardMint,
                         vaultBump: pool.vaultBump,
                         stakedAmount: pool.stakedAmount,
                         rewardAmount: pool.rewardAmount,
                         rewardPerShare: pool.rewardPerShare,
                         totalShares: pool.totalShares,
                         lockUpPeriod: pool.lockUpPeriod,
                         startTime: pool.startTime,
                         endTime: pool.endTime,
                         lastUpdatedSlot: pool.lastUpdatedSlot,
                         updatedAt: pool.updatedAt,
                         name: pool.name,
                         description: pool.description,
                     },
                 })
             ),
        ])

        const serializedPools = await serializePools(sourcePools)

        return NextResponse.json({
            pools: serializedPools,
            ids: serializedPools.map((pool) => pool.id),
        })
    } catch (error) {
        console.error('Error saving selected staking pools:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
