"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { TopBar } from "@/components/layout/TopBar";
import { Card } from "@/components/overview/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { PropertyObjectiveDto } from "@/types/property-objective.types";
import type {
  AutomationMode,
  GrowthObjectiveListResponseDto,
} from "@/types/growth-objective.types";
import type { SettingsDto } from "@/types/tenant.types";

import styles from "./AutomationHubClient.module.css";

/**
 * Byte-for-byte the SAME real mode->label mapping `GrowthObjectivesClient.tsx` already established
 * (`AUTOMATION_MODE_LABELS`, around that file's line 74-79) — NOT exported from that file (it's a
 * private module-local `const`), and that file is out of this phase's touch-scope (read-only per
 * this phase's own audit list), so this is a deliberate re-derivation rather than a new invented
 * label set. Any future change to the real labels must be mirrored in both places by hand.
 */
const AUTOMATION_MODE_LABELS: Record<AutomationMode, string> = {
  ADVISOR: "Advisor",
  COPILOT: "Copilot",
  AUTOPILOT_GUARDED: "Guarded Autopilot",
  AUTONOMOUS: "Autonomous",
};

/** Modes that mean "less human oversight" — the real gate `evaluateAutomationPolicy` treats differently from ADVISOR/COPILOT (see `policy-engine.ts`'s own doc). */
const LOWER_OVERSIGHT_MODES = new Set<AutomationMode>(["AUTOPILOT_GUARDED", "AUTONOMOUS"]);

async function parseError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  return body.error?.message ?? fallback;
}

/**
 * `/automation` — EYVRA SAMANTHA V2 + KAI V2 (this phase). Replaces Phase 50/54's `redirect()`
 * stub (`app/(app)/automation/page.tsx`) with a real, honest READ/DISPLAY-ONLY dashboard over this
 * codebase's 3 real, already-persisted automation-adjacent settings — no new backend logic, no new
 * mutation surface, and critically NO wiring of `evaluateAutomationPolicy`'s pure decision output
 * into any real auto-execution path (see this component's own `PolicyNotWiredNotice` section doc
 * for the honest, visible disclosure of that scope boundary).
 *
 * Structure mirrors `CommandCenterClient.tsx`'s own "hub page built from multiple independent real
 * data sources with honest per-section degrade" convention (e.g. `KaiProductionSummaryCard`'s
 * self-contained fetch-own-data pattern) — each section below is its own small component with its
 * own `fetch`, own loading/error/empty state, so one section failing never blanks the other two.
 */
export function AutomationHubClient(): React.ReactElement {
  return (
    <main>
      <TopBar title="Automation" accentColor="var(--v2-menu-improve)" />
      <div className={styles.page}>
        <Card title="Mode Operasi (DEV/LIVE)" accentColor="var(--v2-menu-improve)">
          <ModeOperasiSummary />
        </Card>

        <Card title="Automasi Campaign" accentColor="var(--v2-menu-improve)">
          <AutomasiCampaignSummary />
        </Card>

        <Card title="Automation Mode per Objective" accentColor="var(--v2-menu-improve)">
          <AutomationModePerObjectiveSummary />
        </Card>

        <PolicyNotWiredNotice />
      </div>
    </main>
  );
}

/**
 * Section 1 — read-only summary of the tenant's real `settings.tenant.mode` (SAME
 * `GET /api/settings` route `SettingsClient.tsx`'s own `loadSettings` already calls). The
 * explanatory copy below is the exact real Indonesian wording already shown on `/settings`'s own
 * "Mode Operasi" card (`SettingsClient.tsx` line ~976-979) — not re-invented here. This page never
 * renders the toggle button itself: `/settings` (the "Koneksi" tab, where `SettingsClient` actually
 * lives) stays the one real place that can mutate this tenant-wide switch.
 */
function ModeOperasiSummary(): React.ReactElement {
  const [settings, setSettings] = useState<SettingsDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await parseError(res, "Gagal memuat Mode Operasi."));
        }
        return (await res.json()) as SettingsDto;
      })
      .then((body) => {
        if (!cancelled) setSettings(body);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat Mode Operasi.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (settings === undefined) {
    return <LoadingSpinner />;
  }

  const mode = settings.tenant.mode;

  return (
    <div data-testid="automation-mode-operasi">
      <div className={styles.summaryRow}>
        <span
          data-testid="automation-mode-operasi-value"
          className={`${styles.statusPill} ${mode === "LIVE" ? styles.statusPillActive : styles.statusPillInactive}`}
        >
          {mode}
        </span>
      </div>
      <p className={styles.hint}>
        DEV: Samantha/Kai hanya mensimulasikan aksi (pause/scale/fix/buat campaign) — tidak ada
        panggilan nyata ke Meta Ads. LIVE: aksi dijalankan nyata ke Meta Ads.
      </p>
      <Link href="/settings?tab=koneksi" className={styles.viewAllLink}>
        Ubah di Settings →
      </Link>
    </div>
  );
}

/**
 * Section 2 — read-only summary of the tenant's real `autoPublishCampaign`/`maxBudgetIncreasePct`
 * (`PropertyObjectiveDto`, `PropertyObjectiveForm.tsx`'s own "Automasi Campaign" card, around that
 * file's line 85-135/440-465). This guardrail is real ONLY for PROPERTY tenants — there is no
 * AUTOMOTIVE equivalent anywhere in this codebase (the AUTOMOTIVE `ObjectiveDto`/`ObjectiveForm`
 * has no `autoPublishCampaign` field at all) — this mirrors the exact same real, honest vertical
 * branch `ObjectiveClient.tsx` itself already performs (`GET /api/settings` → `tenant.vertical`,
 * then `GET /api/property-objective` only for PROPERTY), not a second, parallel vertical-detection
 * mechanism.
 */
function AutomasiCampaignSummary(): React.ReactElement {
  const [vertical, setVertical] = useState<"AUTOMOTIVE" | "PROPERTY" | undefined>(undefined);
  const [objective, setObjective] = useState<PropertyObjectiveDto | null | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await parseError(res, "Gagal memuat Automasi Campaign."));
        }
        return (await res.json()) as SettingsDto;
      })
      .then((body) => {
        if (!cancelled) setVertical(body.tenant.vertical);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat Automasi Campaign.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (vertical !== "PROPERTY") {
      return;
    }
    let cancelled = false;
    fetch("/api/property-objective")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await parseError(res, "Gagal memuat Automasi Campaign."));
        }
        return (await res.json()) as { objective: PropertyObjectiveDto | null };
      })
      .then((body) => {
        if (!cancelled) setObjective(body.objective);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat Automasi Campaign.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [vertical]);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (vertical === undefined) {
    return <LoadingSpinner />;
  }

  if (vertical !== "PROPERTY") {
    return (
      <EmptyState
        title="Guardrail ini khusus tenant PROPERTY"
        description="Auto-publish campaign & batas kenaikan budget adalah pengaturan real property_objectives — belum ada padanannya untuk tenant AUTOMOTIVE."
      />
    );
  }

  if (objective === undefined) {
    return <LoadingSpinner />;
  }

  if (objective === null) {
    return (
      <EmptyState
        title="Belum ada Objective bulan ini"
        description="Set Objective di /settings dulu sebelum pengaturan automasi campaign tersedia."
      />
    );
  }

  return (
    <div data-testid="automation-auto-publish">
      <div className={styles.summaryRow}>
        <span
          data-testid="automation-auto-publish-value"
          className={`${styles.statusPill} ${
            objective.autoPublishCampaign ? styles.statusPillActive : styles.statusPillInactive
          }`}
        >
          {objective.autoPublishCampaign ? "Aktif" : "Nonaktif"}
        </span>
        <span data-testid="automation-max-budget-increase" className={styles.value}>
          Batas kenaikan budget: {objective.maxBudgetIncreasePct}%
        </span>
      </div>
      <p className={styles.hint}>
        Kalau ada asset kreatif baru dari Kai untuk listing yang belum punya campaign aktif,
        Samantha bisa langsung publish campaign-nya di mode LIVE — TANPA toggle ini aktif, publish
        tetap butuh approve manual kamu dulu.
      </p>
      <Link href="/settings" className={styles.viewAllLink}>
        Ubah di Settings →
      </Link>
    </div>
  );
}

/**
 * Section 3 — real, aggregate summary of `automationMode` ACROSS every real `growth_objectives`
 * row, from the SAME real `GET /api/growth-objectives` route `GrowthObjectivesClient.tsx`'s own
 * `load()` already calls (verified: the real backend `GET` takes no pagination params — see
 * `app/api/growth-objectives/route.ts`'s own doc — so this genuinely is "every objective", not a
 * partial page). Counts are computed client-side over the already-fetched list, same
 * "client-side aggregation over an already-fetched list" discipline
 * `CommandCenterClient.tsx`'s own `computeCampaignVerdicts` already establishes — no new backend
 * logic for the counts.
 */
function AutomationModePerObjectiveSummary(): React.ReactElement {
  const [data, setData] = useState<GrowthObjectiveListResponseDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/growth-objectives")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await parseError(res, "Gagal memuat Growth Objectives."));
        }
        return (await res.json()) as GrowthObjectiveListResponseDto;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat Growth Objectives.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (data === undefined) {
    return <LoadingSpinner />;
  }

  if (data.objectives.length === 0) {
    return (
      <EmptyState
        title="Belum ada Growth Objective"
        description="Belum ada Growth Objective — automation mode diatur per objective saat dibuat di /growth-objectives."
      />
    );
  }

  const counts: Record<AutomationMode, number> = {
    ADVISOR: 0,
    COPILOT: 0,
    AUTOPILOT_GUARDED: 0,
    AUTONOMOUS: 0,
  };
  for (const objective of data.objectives) {
    counts[objective.automationMode] += 1;
  }

  const lowerOversightObjectives = data.objectives.filter((objective) =>
    LOWER_OVERSIGHT_MODES.has(objective.automationMode),
  );

  return (
    <div data-testid="automation-mode-per-objective">
      <p data-testid="automation-mode-counts" className={styles.value}>
        {(Object.keys(AUTOMATION_MODE_LABELS) as AutomationMode[])
          .map((mode) => `${counts[mode]} ${AUTOMATION_MODE_LABELS[mode]}`)
          .join(" · ")}
      </p>

      {lowerOversightObjectives.length > 0 ? (
        <>
          <p className={styles.hint}>
            Objective dengan lebih sedikit oversight manusia (Guarded Autopilot/Autonomous):
          </p>
          <ul data-testid="automation-lower-oversight-list" className={styles.objectiveList}>
            {lowerOversightObjectives.map((objective) => (
              <li key={objective.id} className={styles.objectiveRow}>
                <Link href={`/growth-objectives/${objective.id}`} className={styles.viewAllLink}>
                  {objective.metric === "HOT_LEADS" ? "Hot Leads" : objective.metric} — target{" "}
                  {objective.targetValue.toLocaleString("id-ID")} (
                  {AUTOMATION_MODE_LABELS[objective.automationMode]})
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className={styles.hint} data-testid="automation-no-lower-oversight">
          Tidak ada objective yang memakai Guarded Autopilot/Autonomous saat ini.
        </p>
      )}

      <Link href="/growth-objectives" className={styles.viewAllLink}>
        Lihat semua Growth Objective →
      </Link>
    </div>
  );
}

/**
 * Section 4 — a real, visible (not code-comment-only) honest disclosure that
 * `evaluateAutomationPolicy` (`automation-policy/domain/policy-engine.ts`) exists and is tested,
 * but is NOT wired into any real automatic execution path. Same honest-omission tone
 * `AutomationPanel.tsx`'s own "Mode: Belum tersedia" block already uses ("Belum tersedia — sistem
 * guardrail/mode otomasi ... belum ada di backend ini. Setiap tindakan ... saat ini selalu diklik
 * manual.") — this section is the accurate, updated version of that same honest note now that the
 * pure decision-support function DOES exist (unlike when `AutomationPanel.tsx` was written), while
 * still being clear it drives nothing automatically yet.
 */
function PolicyNotWiredNotice(): React.ReactElement {
  return (
    <div data-testid="automation-policy-not-wired-notice">
      <EmptyState
        title="Automation Mode belum menggerakkan eksekusi otomatis"
        description="evaluateAutomationPolicy (logika gating keputusan Advisor/Copilot/Guarded Autopilot/Autonomous) sudah ada dan sudah diuji, tapi BELUM disambungkan ke eksekusi nyata mana pun. Setiap keputusan Samantha yang actionable — apa pun automationMode objective-nya — tetap selalu menunggu klik 'Terapkan'/approve manual dari manusia hari ini."
      />
    </div>
  );
}
