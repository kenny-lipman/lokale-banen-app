/**
 * Helpers voor de incrementele lijst-scan (Fase 3).
 * De zoek-API sorteert op nieuwste; zodra een hele pagina enkel reeds-bekende
 * vacatures bevat, zitten daarna alleen oudere/bekende. Na N zulke pagina's stoppen.
 */

import type { UpsertOutcome } from "./upsert";

/** True als de pagina niet leeg is en uitsluitend reeds-bekende ("seen") vacatures bevat. */
export function pageAllKnown(outcomes: UpsertOutcome[]): boolean {
  return outcomes.length > 0 && outcomes.every((o) => o === "seen");
}

/** True als we genoeg opeenvolgende volledig-bekende pagina's hebben gezien. */
export function shouldStopIncremental(consecutiveKnownPages: number, threshold: number): boolean {
  return consecutiveKnownPages >= threshold;
}
