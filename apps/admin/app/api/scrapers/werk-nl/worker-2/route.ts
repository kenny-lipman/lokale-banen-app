// @auth SECRET
/**
 * werk.nl detail-verrijking worker (tweede parallelle instance).
 *
 * Identiek aan .../worker: dunne wrapper rond runWorkerHandler. Beide draaien
 * elke 6 min als aparte cron en claimen via FOR UPDATE SKIP LOCKED disjuncte
 * queue-rijen, zodat de detail-backlog ~2x sneller wordt gedraind.
 */

import { withCronAuth } from "@/lib/auth-middleware";
import { runWorkerHandler } from "@/lib/scrapers/werk_nl/worker-handler";

export const runtime = "nodejs";
export const preferredRegion = ["fra1", "ams1"];
export const maxDuration = 300;

export const POST = withCronAuth(runWorkerHandler);
export const GET = POST;
