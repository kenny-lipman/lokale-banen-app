/**
 * Bulk Pipedrive Backfill - Local script with parallel workers
 *
 * Runs PARALLEL_WORKERS concurrent batches, each with its own offset.
 * No Vercel timeout. Proactive rate limiting for Pipedrive (100 req/10s).
 *
 * Run with: npx tsx scripts/bulk-pipedrive-backfill.ts
 *
 * Options (env vars):
 *   BATCH_SIZE=20              Contacts per worker per round (default: 20)
 *   PARALLEL_WORKERS=2         Concurrent workers (default: 2)
 *   DELAY_BETWEEN_ROUNDS=5000  Ms between rounds (default: 5s)
 *   REQUIRE_POSTAL_CODE=true   Only contacts with postal code (default: true)
 *   INCLUDE_BOUNCED=false      Include bounced contacts (default: false)
 *   MAX_ROUNDS=0               Stop after N rounds, 0=unlimited (default: 0)
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
  const { instantlyPipedriveSyncService } = await import('../lib/services/instantly-pipedrive-sync.service');

  const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '20', 10);
  const PARALLEL_WORKERS = parseInt(process.env.PARALLEL_WORKERS || '2', 10);
  const DELAY_BETWEEN_ROUNDS = parseInt(process.env.DELAY_BETWEEN_ROUNDS || '3000', 10);
  const REQUIRE_POSTAL_CODE = process.env.REQUIRE_POSTAL_CODE !== 'false';
  const INCLUDE_BOUNCED = process.env.INCLUDE_BOUNCED === 'true';
  const MAX_ROUNDS = parseInt(process.env.MAX_ROUNDS || '0', 10);

  const startTime = Date.now();

  console.log('=== Bulk Pipedrive Backfill (Parallel) ===');
  console.log(`Workers: ${PARALLEL_WORKERS}, Batch size: ${BATCH_SIZE} (${PARALLEL_WORKERS * BATCH_SIZE} contacts/round)`);
  console.log(`Delay between rounds: ${DELAY_BETWEEN_ROUNDS}ms`);
  console.log(`Require postal code: ${REQUIRE_POSTAL_CODE}, Include bounced: ${INCLUDE_BOUNCED}`);
  console.log(`Started at: ${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}`);
  console.log('');

  let totalSynced = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let roundCount = 0;

  while (true) {
    roundCount++;

    if (MAX_ROUNDS > 0 && roundCount > MAX_ROUNDS) {
      console.log(`\n⏹️  Reached max rounds (${MAX_ROUNDS}), stopping.`);
      break;
    }

    const roundStart = Date.now();
    console.log(`--- Round ${roundCount} (${new Date().toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam' })}) ---`);

    // Launch parallel workers with staggered offsets
    const workerPromises = Array.from({ length: PARALLEL_WORKERS }, (_, i) => {
      const offset = i * BATCH_SIZE;
      return instantlyPipedriveSyncService.syncUnprocessedContactsToPipedrive(
        BATCH_SIZE,
        { includeBounced: INCLUDE_BOUNCED, requirePostalCode: REQUIRE_POSTAL_CODE, offset }
      ).catch((error: Error) => ({
        processed: 0, synced: 0, skipped: 0, errors: BATCH_SIZE,
        totalEligible: 0, remaining: -1,
        details: [{ email: 'batch_error', success: false, error: error.message }],
      }));
    });

    const results = await Promise.all(workerPromises);

    const roundDuration = Date.now() - roundStart;
    let roundSynced = 0;
    let roundErrors = 0;
    let remaining = 0;

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      roundSynced += r.synced;
      roundErrors += r.errors;
      totalSkipped += r.skipped;
      if (r.remaining > remaining) remaining = r.remaining;

      // Log per-worker errors
      const errors = r.details.filter(d => d.error);
      if (errors.length > 0) {
        for (const d of errors) {
          console.log(`  ⚠️  W${i}: ${d.email}: ${d.error}`);
        }
      }
    }

    totalSynced += roundSynced;
    totalErrors += roundErrors;

    console.log(`  Synced: ${roundSynced}, Errors: ${roundErrors} (${formatDuration(roundDuration)})`);
    console.log(`  Remaining: ~${remaining} | Total synced: ${totalSynced}`);

    if (totalSynced > 0) {
      const elapsed = Date.now() - startTime;
      const avgPerContact = elapsed / totalSynced;
      console.log(`  ETA: ~${formatDuration(avgPerContact * remaining)}`);
    }

    // Check if done
    if (roundSynced === 0 && roundErrors === 0) {
      console.log('\n✅ All contacts processed.');
      break;
    }

    // Extra delay on rate limiting
    const hasRateLimitErrors = results.some(r =>
      r.details.some(d => d.error?.includes('rate limit') || d.error?.includes('429'))
    );
    if (hasRateLimitErrors) {
      console.log('  🚦 Rate limit detected, extra 30s pause...');
      await new Promise(resolve => setTimeout(resolve, 30000));
    }

    console.log(`  ⏳ Waiting ${DELAY_BETWEEN_ROUNDS / 1000}s...`);
    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_ROUNDS));
    console.log('');
  }

  const totalDuration = Date.now() - startTime;
  console.log('\n' + '='.repeat(60));
  console.log('📊 BULK BACKFILL SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Rounds: ${roundCount}, Workers: ${PARALLEL_WORKERS}`);
  console.log(`  ✅ Synced: ${totalSynced}`);
  console.log(`  ⏭️  Skipped: ${totalSkipped}`);
  console.log(`  ❌ Errors: ${totalErrors}`);
  console.log(`  ⏱️  Duration: ${formatDuration(totalDuration)}`);
  console.log(`  📈 Avg: ${totalSynced > 0 ? formatDuration(totalDuration / totalSynced) : 'N/A'}/contact`);
  console.log(`\nFinished: ${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}`);
}

main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
