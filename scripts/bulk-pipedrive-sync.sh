#!/bin/bash
# Bulk Pipedrive sync script - runs 3 parallel batches
# Each batch processes 20 contacts with requirePostalCode=true
# Workers use offsets 0, 20, 40 to avoid picking the same contacts

set -e

CRON_SECRET=$(grep CRON_SECRET .env.local | head -1 | cut -d= -f2)
URL="https://lokale-banen-app.vercel.app/api/cron/sync-contacts-to-pipedrive"
BATCH_SIZE=20
PARALLEL=3
ROUND=0
TOTAL_SYNCED=0

echo "=== Bulk Pipedrive Sync ==="
echo "Batch size: $BATCH_SIZE, Parallel workers: $PARALLEL"
echo "Starting at $(date)"
echo ""

run_batch() {
  local offset=$1
  local worker=$2
  local result
  result=$(curl -s -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $CRON_SECRET" \
    -d "{\"batchSize\": $BATCH_SIZE, \"requirePostalCode\": true, \"offset\": $offset}" \
    --max-time 310)
  echo "$result"
}

while true; do
  ROUND=$((ROUND + 1))
  echo "--- Round $ROUND ($(date '+%H:%M:%S')) ---"

  # Launch parallel workers
  pids=()
  tmpfiles=()
  for i in $(seq 0 $((PARALLEL - 1))); do
    offset=$((i * BATCH_SIZE))
    tmpfile=$(mktemp)
    tmpfiles+=("$tmpfile")
    run_batch $offset $i > "$tmpfile" 2>&1 &
    pids+=($!)
    echo "  Worker $i started (offset: $offset)"
  done

  # Wait for all workers
  round_synced=0
  round_remaining=0
  all_done=true

  for i in $(seq 0 $((PARALLEL - 1))); do
    wait ${pids[$i]} || true
    result=$(cat "${tmpfiles[$i]}")
    rm -f "${tmpfiles[$i]}"

    # Parse JSON result
    synced=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('synced',0))" 2>/dev/null || echo "0")
    remaining=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('remaining',0))" 2>/dev/null || echo "0")
    errors=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('errors',0))" 2>/dev/null || echo "0")
    duration=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('duration','?'))" 2>/dev/null || echo "?")

    if echo "$result" | grep -q "FUNCTION_INVOCATION_TIMEOUT"; then
      echo "  Worker $i: TIMEOUT"
      all_done=false
    elif [ "$synced" = "0" ] && [ "$remaining" = "0" ]; then
      echo "  Worker $i: Done (no more contacts)"
    else
      echo "  Worker $i: synced=$synced, errors=$errors, remaining=$remaining ($duration)"
      round_synced=$((round_synced + synced))
      round_remaining=$remaining
      if [ "$remaining" -gt 0 ] 2>/dev/null; then
        all_done=false
      fi
    fi
  done

  TOTAL_SYNCED=$((TOTAL_SYNCED + round_synced))
  echo "  Round total: +$round_synced synced (cumulative: $TOTAL_SYNCED, remaining: ~$round_remaining)"
  echo ""

  # Check if done
  if [ "$round_synced" -eq 0 ] && [ "$all_done" = true ]; then
    echo "=== ALL DONE ==="
    echo "Total synced: $TOTAL_SYNCED"
    echo "Finished at $(date)"
    break
  fi

  # Brief pause between rounds to let Pipedrive rate limits recover
  sleep 5
done
