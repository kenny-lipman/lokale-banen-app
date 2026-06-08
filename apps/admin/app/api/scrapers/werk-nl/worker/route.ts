// @auth SECRET
/**
 * werk.nl detail-verrijking worker (Fase 2/3).
 *
 * POST/GET /api/scrapers/werk-nl/worker  body: { orchestrationId?, batchSize?, maxBatches? }
 *
 * Dunne route-wrapper; de logica zit in lib/scrapers/werk_nl/worker-handler.ts
 * zodat een tweede cron-instance (.../worker-2) dezelfde drain-loop kan draaien.
 * De queue claimt via FOR UPDATE SKIP LOCKED, dus parallelle workers pakken
 * disjuncte rijen (geen dubbel werk).
 */

import { withCronAuth } from "@/lib/auth-middleware";
import { runWorkerHandler } from "@/lib/scrapers/werk_nl/worker-handler";

export const runtime = "nodejs";
export const preferredRegion = ["fra1", "ams1"];
export const maxDuration = 300;

export const POST = withCronAuth(runWorkerHandler);
export const GET = POST;
