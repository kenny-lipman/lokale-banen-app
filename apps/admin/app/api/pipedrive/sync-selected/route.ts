/**
 * POST /api/pipedrive/sync-selected
 *
 * Syncs selected contacts to Pipedrive via SSE streaming.
 * Creates/updates organisations and persons with all custom fields.
 *
 * Request body: { contactIds: string[] }  (max 500)
 * Response: text/event-stream with progress events
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncContactBatch, type SyncEvent } from '@/lib/services/pipedrive-ui-sync.service';

const MAX_BATCH_SIZE = 500;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contactIds } = body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: 'contactIds is vereist (array van UUIDs)' },
        { status: 400 }
      );
    }

    if (contactIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Maximaal ${MAX_BATCH_SIZE} contacten per sync` },
        { status: 400 }
      );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: SyncEvent) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            // Stream closed by client
          }
        };

        try {
          await syncContactBatch(contactIds, sendEvent);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Onbekende fout';
          sendEvent({ type: 'error', contact: '-', reason: msg });
          sendEvent({
            type: 'done',
            success: 0,
            failed: contactIds.length,
            skipped: 0,
            total: contactIds.length,
            duration: '0s',
          });
        }

        try {
          controller.close();
        } catch {
          // Already closed
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('Pipedrive sync-selected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
