/**
 * Bulk Pipedrive Backfill - Local script (no Vercel timeout)
 *
 * Processes all unsynced contacts in batches, with proactive rate limiting
 * to stay within Pipedrive's 100 requests / 10 seconds limit.
 *
 * Run with: npx tsx scripts/bulk-pipedrive-backfill.ts
 *
 * Options (env vars):
 *   BATCH_SIZE=20          Contacts per batch (default: 20)
 *   DELAY_BETWEEN_BATCHES=10000  Ms between batches (default: 10s)
 *   REQUIRE_POSTAL_CODE=true     Only process contacts with postal code (default: true)
 *   INCLUDE_BOUNCED=false        Include bounced contacts (default: false)
 *   MAX_BATCHES=0                Stop after N batches, 0=unlimited (default: 0)
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

async function main() {
  // Dynamic import: env vars must be loaded before module-level singletons initialize
  const { instantlyPipedriveSyncService } = await import('../lib/services/instantly-pipedrive-sync.service');

  const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '20', 10);
  const DELAY_BETWEEN_BATCHES = parseInt(process.env.DELAY_BETWEEN_BATCHES || '10000', 10);
  const REQUIRE_POSTAL_CODE = process.env.REQUIRE_POSTAL_CODE !== 'false';
  const INCLUDE_BOUNCED = process.env.INCLUDE_BOUNCED === 'true';
  const MAX_BATCHES = parseInt(process.env.MAX_BATCHES || '0', 10);

  const startTime = Date.now();

  console.log('=== Bulk Pipedrive Backfill ===');
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Delay between batches: ${DELAY_BETWEEN_BATCHES}ms`);
  console.log(`Require postal code: ${REQUIRE_POSTAL_CODE}`);
  console.log(`Include bounced: ${INCLUDE_BOUNCED}`);
  console.log(`Max batches: ${MAX_BATCHES || 'unlimited'}`);
  console.log(`Started at: ${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}`);
  console.log('');

  let totalSynced = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let batchCount = 0;
  let consecutiveEmptyBatches = 0;

  while (true) {
    batchCount++;

    if (MAX_BATCHES > 0 && batchCount > MAX_BATCHES) {
      console.log(`\n⏹️  Reached max batches (${MAX_BATCHES}), stopping.`);
      break;
    }

    const batchStart = Date.now();
    console.log(`--- Batch ${batchCount} (${new Date().toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam' })}) ---`);

    try {
      const result = await instantlyPipedriveSyncService.syncUnprocessedContactsToPipedrive(
        BATCH_SIZE,
        {
          includeBounced: INCLUDE_BOUNCED,
          requirePostalCode: REQUIRE_POSTAL_CODE,
        }
      );

      const batchDuration = Date.now() - batchStart;
      totalSynced += result.synced;
      totalSkipped += result.skipped;
      totalErrors += result.errors;

      console.log(`  Synced: ${result.synced}, Skipped: ${result.skipped}, Errors: ${result.errors} (${formatDuration(batchDuration)})`);
      console.log(`  Remaining: ${result.remaining} | Total synced so far: ${totalSynced}`);

      // Estimate time remaining
      if (totalSynced > 0) {
        const elapsed = Date.now() - startTime;
        const avgPerContact = elapsed / totalSynced;
        const estimatedRemaining = avgPerContact * result.remaining;
        console.log(`  ETA: ~${formatDuration(estimatedRemaining)}`);
      }

      // Check if done
      if (result.remaining === 0 || result.processed === 0) {
        consecutiveEmptyBatches++;
        if (consecutiveEmptyBatches >= 3) {
          console.log('\n✅ All contacts processed (3 empty batches in a row).');
          break;
        }
      } else {
        consecutiveEmptyBatches = 0;
      }

      // Log errors for investigation
      const errorDetails = result.details.filter(d => d.error);
      if (errorDetails.length > 0) {
        console.log(`  ⚠️  Errors:`);
        for (const d of errorDetails) {
          console.log(`     ${d.email}: ${d.error}`);
        }
      }

      // Check for rate limit errors — add extra delay
      const rateLimitErrors = errorDetails.filter(d =>
        d.error?.includes('rate limit') || d.error?.includes('429')
      );
      if (rateLimitErrors.length > 0) {
        const extraDelay = 30000;
        console.log(`  🚦 Rate limit hit on ${rateLimitErrors.length} contacts! Waiting extra ${extraDelay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, extraDelay));
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Batch error: ${errorMsg}`);
      totalErrors++;

      if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
        console.log('  🚦 Rate limited! Waiting 60s before next batch...');
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }

    // Proactive delay between batches to respect Pipedrive rate limits
    // Each contact does 7-11 API calls. With 20 contacts + 200ms per-lead delay:
    // ~200 API calls per batch. Rate limit = 100/10s. 10s pause lets the window reset.
    console.log(`  ⏳ Waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...`);
    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    console.log('');
  }

  // Summary
  const totalDuration = Date.now() - startTime;
  console.log('\n' + '='.repeat(60));
  console.log('📊 BULK BACKFILL SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Batches processed: ${batchCount}`);
  console.log(`  ✅ Total synced: ${totalSynced}`);
  console.log(`  ⏭️  Total skipped: ${totalSkipped}`);
  console.log(`  ❌ Total errors: ${totalErrors}`);
  console.log(`  ⏱️  Total duration: ${formatDuration(totalDuration)}`);
  console.log(`  📈 Avg per contact: ${totalSynced > 0 ? formatDuration(totalDuration / totalSynced) : 'N/A'}`);
  console.log(`\nFinished at: ${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}`);
}

main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
