/**
 * Pass-state voor de werk.nl volledige-pass scan (Fase 3).
 * Singleton-rij in werk_nl_scan_state: cursor + pass-grenzen. Een volledige pass loopt
 * over meerdere cron-runs (cursor); na voltooiing draait de delisting-sweep (ADR 0002).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ScanState {
  id: number;
  pass_cursor: number;
  pass_started_at: string | null;
  pass_completed_at: string | null;
}

/** Pure beslissing: moet er een nieuwe volledige pass starten? */
export function isPassDue(state: ScanState, nowMs: number, staleDays: number): boolean {
  if (state.pass_cursor !== 0) return false; // pass loopt al
  if (!state.pass_completed_at) return true; // nooit eerder voltooid
  const completedMs = Date.parse(state.pass_completed_at);
  return nowMs - completedMs >= staleDays * 86_400_000;
}

export async function getScanState(supabase: SupabaseClient): Promise<ScanState> {
  const { data, error } = await supabase
    .from("werk_nl_scan_state")
    .select("id, pass_cursor, pass_started_at, pass_completed_at")
    .eq("id", 1)
    .single();
  if (error || !data) throw new Error(`[werknl] scan-state lezen faalde: ${error?.message ?? "geen rij"}`);
  return data as ScanState;
}

/** Start een nieuwe pass: cursor naar 1, pass_started_at = now, completed reset. */
export async function startPass(supabase: SupabaseClient, nowIso: string): Promise<void> {
  const { error } = await supabase
    .from("werk_nl_scan_state")
    .update({ pass_cursor: 1, pass_started_at: nowIso, pass_completed_at: null })
    .eq("id", 1);
  if (error) throw new Error(`[werknl] startPass faalde: ${error.message}`);
}

/** Persisteer de huidige cursor (voortgang voor de volgende run). */
export async function saveCursor(supabase: SupabaseClient, cursor: number): Promise<void> {
  const { error } = await supabase.from("werk_nl_scan_state").update({ pass_cursor: cursor }).eq("id", 1);
  if (error) throw new Error(`[werknl] saveCursor faalde: ${error.message}`);
}

/** Rond de pass af: cursor naar 0 (idle), pass_completed_at = now. */
export async function completePass(supabase: SupabaseClient, nowIso: string): Promise<void> {
  const { error } = await supabase
    .from("werk_nl_scan_state")
    .update({ pass_cursor: 0, pass_completed_at: nowIso })
    .eq("id", 1);
  if (error) throw new Error(`[werknl] completePass faalde: ${error.message}`);
}
