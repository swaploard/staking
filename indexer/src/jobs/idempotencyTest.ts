import { PrismaClient } from "@prisma/client";
import { Logger } from "../logger";
import { IngestionContract } from "../ingestion/contract";

export async function runIdempotencyTest() {
    const logger = new Logger("IdempotencyTest");
    const prisma = new PrismaClient();
    const contract = new IngestionContract(prisma);

    const TEST_SIGNATURE = `mock-test-sig-${Date.now()}`;
    const TEST_SLOT = BigInt(123456789);
    const CONCURRENCY = 50;

    logger.info(`Starting idempotency test with signature ${TEST_SIGNATURE} at slot ${TEST_SLOT}`);
    logger.info(`Spawning ${CONCURRENCY} concurrent ingest requests...`);

    let executionCount = 0;

    const promises = Array.from({ length: CONCURRENCY }).map(async (_, index) => {
        // Sleep randomly 0-50ms to simulate network jitter
        await new Promise(r => setTimeout(r, Math.random() * 50));
        
        return contract.processTransaction(
            {
                signature: TEST_SIGNATURE,
                slot: TEST_SLOT,
            },
            async (data, tx) => {
                // This payload should only execute exactly ONCE despite the 50 concurrent calls
                executionCount++;
                
                // Simulate some processing time
                await new Promise(r => setTimeout(r, 200));

                await tx.txActivity.create({
                    data: {
                        signature: data.signature,
                        slot: data.slot,
                        ixIndex: 0,
                        eventType: "MockIdempotencyTest",
                        status: "confirmed",
                    }
                });
                logger.info(`Worker ${index} executed the inner transaction logic!`);
            }
        );
    });

    const results = await Promise.all(promises);
    
    // Check results
    const successes = results.filter(r => r.success).length;
    const errors = results.filter(r => !r.success);
    
    logger.info(`--- Idempotency Test Results ---`);
    logger.info(`Total Concurrent Requests: ${CONCURRENCY}`);
    logger.info(`Inner Executor Count: ${executionCount}`);
    
    if (executionCount === 1) {
        logger.info(`✅ SUCCESS: Idempotency contract held! Exactly 1 worker executed the insert.`);
    } else {
        logger.error(`❌ FAILED: Idempotency contract breached. Executed ${executionCount} times.`);
        process.exitCode = 1;
    }

    // Let's verify DB state
    const processedSig = await prisma.processedSignature.findUnique({
        where: { signature: TEST_SIGNATURE }
    });
    
    const activityRows = await prisma.txActivity.findMany({
        where: { signature: TEST_SIGNATURE }
    });

    logger.info(`DB ProcessedSignature status: ${processedSig?.status}`);
    logger.info(`DB TxActivity rows: ${activityRows.length}`);

    await prisma.$disconnect();
}

if (require.main === module) {
    runIdempotencyTest().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
