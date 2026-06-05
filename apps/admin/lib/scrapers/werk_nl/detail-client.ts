/**
 * Detail-client: haalt één vacature-detail op via de publieke werk.nl detail-API.
 * 404 -> notFound (geen throw), zodat de worker de vacature kan archiveren i.p.v. verrijken.
 */

import { werknlFetch, type WerknlSession } from "./session";
import { DetailResponseSchema, type WerknlDetail } from "./detail-types";
import { DETAIL_URL_BASE } from "./constants";

export type FetchDetailResult =
  | { notFound: true }
  | { notFound: false; detail: WerknlDetail };

export async function fetchDetail(
  session: WerknlSession,
  referenceNumber: number
): Promise<FetchDetailResult> {
  const res = await werknlFetch(session, `${DETAIL_URL_BASE}/${referenceNumber}`);
  if (res.status === 404) return { notFound: true };
  if (!res.ok) {
    throw new Error(`[werknl] detail-API HTTP ${res.status} (ref ${referenceNumber})`);
  }

  const raw = JSON.parse(await res.text());
  const parsed = DetailResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`[werknl] detail-payload ongeldig (ref ${referenceNumber}): ${parsed.error.message}`);
  }
  return { notFound: false, detail: parsed.data };
}
