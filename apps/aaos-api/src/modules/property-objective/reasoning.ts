/**
 * `buildCplReasoningText` (AAOS LOOP UPGRADE, Sprint 6 Prompt 15) — real, business-context-aware
 * reasoning text for a real HIGH_CPL campaign-trigger decision
 * (`scheduler/domain/campaign-trigger.ts`'s `shouldCreateNewCampaign`), wired into
 * `SchedulerService.recordCampaignTriggerDecision` via `ActivityLogger.logReasoning` — the real,
 * already-existing `agent_activities.reasoning` field the dashboard's Activity detail drawer's
 * "Reasoning" tab already renders (`ActivityDetailDrawer.tsx`/`ActivityDetailPanel.tsx`).
 *
 * REAL WIRING POINT (investigated, not the spec's literal one): the spec named
 * `apps/eyvra-dashboard/.../CampaignDetailDrawer.tsx`'s "Verdict card reasoning" and a PROPERTY
 * "Tab Verdict" — neither exists. This app's ONE real PROPERTY-facing "AI decided X, here is why"
 * text field is `agent_activities.reasoning` (`ActivityLogger.logReasoning`), and its one real
 * CPL-threshold decision point is `shouldCreateNewCampaign`'s `HIGH_CPL` reason — reused here
 * honestly rather than inventing a parallel reasoning-text mechanism.
 *
 * WITH business context filled in (`isBusinessContextFilled`): explicit numbers, per the spec's own
 * exact example format — "CPL campaign ini IDR 37.421 — di atas batas IDR 30.000 yang di-set →
 * rekomendasi PAUSE".
 *
 * WITHOUT business context: the generic-threshold sentence this codebase already used before this
 * phase (`cplIDR` vs. the tenant's own portfolio `benchmarkCplIDR` × `cplMultiplier`) — never a
 * fabricated "batas" number when none was ever set.
 */

const IDR_FORMATTER = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

function formatIdr(value: number): string {
  return `IDR ${IDR_FORMATTER.format(Math.round(value))}`;
}

export interface CplReasoningInput {
  readonly cplIDR: number;
  readonly benchmarkCplIDR: number;
  readonly cplMultiplier: number;
  /** `undefined` when the tenant's business context is not filled in (see `isBusinessContextFilled`). */
  readonly breakevenCpl?: number;
}

export function buildCplReasoningText(input: CplReasoningInput): string {
  if (input.breakevenCpl !== undefined && input.breakevenCpl > 0) {
    return `CPL campaign ini ${formatIdr(input.cplIDR)} — di atas batas ${formatIdr(input.breakevenCpl)} yang di-set → rekomendasi PAUSE.`;
  }
  const threshold = input.benchmarkCplIDR * input.cplMultiplier;
  return `Cost per hasil terlalu tinggi — CPL ${formatIdr(input.cplIDR)} melebihi ${String(input.cplMultiplier)}x rata-rata portfolio (${formatIdr(threshold)}) → rekomendasi PAUSE. Isi konteks bisnis di Settings > Objective supaya rekomendasi lebih akurat.`;
}
