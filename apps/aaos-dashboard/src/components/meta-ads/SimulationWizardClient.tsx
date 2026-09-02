"use client";

import { useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useCampaignsSnapshot } from "@/lib/useCampaignsSnapshot";
import type {
  CampaignAdDto,
  ObjectiveDto,
  SimulationHistoryEntryDto,
  SimulationKaiStageDto,
  SimulationLogEntryDto,
  SimulationStatusDto,
} from "@/types/dashboard.types";
import type { ListingDto, ListingListDto } from "@/types/listing.types";
import type { PropertyObjectiveDto } from "@/types/property-objective.types";
import type { SettingsDto, Vertical } from "@/types/tenant.types";

import styles from "./SimulationWizardClient.module.css";

const FREQUENCY_THRESHOLD = 3.5;
const POLL_INTERVAL_MS = 3000;

const AD_ANGLES = [
  "DP_RINGAN",
  "KREDIT_SYARIAH",
  "GUDANGNYA",
  "QNA",
  "DISCOVERY",
  "TESTIMONIAL",
  "WEBSITE_REDIRECT",
] as const;

/** The real 10 `PersonaId` members (`@aos/conversation-simulator`'s `PersonaId` enum, verified against source — see this component's class doc) — never the spec's own illustrative "Pak Andi/Bu Sari" 4-persona naming. */
const PERSONAS: ReadonlyArray<{ readonly id: string; readonly label: string }> = [
  { id: "cold_buyer", label: "Cold Buyer" },
  { id: "budget_buyer", label: "Budget Buyer" },
  { id: "ready_buyer", label: "Ready Buyer" },
  { id: "specific_unit_buyer", label: "Specific Unit" },
  { id: "kredit_buyer", label: "Kredit Buyer" },
  { id: "syariah_buyer", label: "Syariah Buyer" },
  { id: "ghost_buyer", label: "Ghost Buyer" },
  { id: "complainer_buyer", label: "Complainer" },
  { id: "first_time_buyer", label: "First-Time Buyer" },
  { id: "urgent_buyer", label: "Urgent Buyer" },
];

/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 6 — the SAME real 10 `PersonaId` members above,
 * relabelled with property-buyer framing for a `PROPERTY`-vertical tenant. No new persona ids are
 * invented: `@aos/conversation-simulator`'s `PersonaId` enum (what `apps/aaos-simulator`'s real
 * `/api/simulate` actually accepts) has no separate property-vertical member set, so Step 1
 * switches only the DISPLAY label, never the id sent to `/api/simulation/start`'s `personaIds`.
 */
const PROPERTY_PERSONA_LABELS: Readonly<Record<string, string>> = {
  cold_buyer: "Cold Buyer (Baru Lihat-lihat)",
  budget_buyer: "Budget Buyer (Sensitif Harga)",
  ready_buyer: "Ready Buyer (Siap Beli)",
  specific_unit_buyer: "Listing Spesifik",
  kredit_buyer: "KPR Buyer",
  syariah_buyer: "Syariah Buyer",
  ghost_buyer: "Ghost Buyer",
  complainer_buyer: "Complainer",
  first_time_buyer: "First-Time Buyer (KPR Pemula)",
  urgent_buyer: "Urgent Buyer (Butuh Cepat)",
};

/** The real `Branch` enum (`@aos/meta-ads-connector`'s `Branch.ts`, verified against source). */
const BRANCHES = ["CINERE", "BINTARO", "BANDUNG", "JABODETABEK", "BOOST", "MULTI", "UMUM"] as const;

/**
 * The real 8 `PropertyAdAngle` members (`@aos/creative-agent`'s `PropertyAdAngle` enum, verified
 * against source) — Step 1's PROPERTY-only angle selector, sent as `kaiPropertyAngle` (a separate
 * field/enum from `AD_ANGLES`'s automotive `AdAngle` — see `PropertyAdAngle.ts`'s docstring for
 * why the two vocabularies are deliberately not unified).
 */
const PROPERTY_AD_ANGLES = [
  "DP_RINGAN",
  "READY_HUNI",
  "INVESTASI",
  "EXCLUSIVE",
  "SYARIAH",
  "PROMO_TERBATAS",
  "TESTIMONIAL",
  "VIRTUAL_TOUR",
] as const;

const STEPS = ["SETUP", "SAMANTHA", "KAI", "CLARA", "JUDGE", "REVIEW"] as const;
type WizardStep = (typeof STEPS)[number];

/** Days used to derive a daily budget from the objective's real monthly `budgetAllocation` — the same /30 convention already used elsewhere this session. */
const DAYS_PER_MONTH = 30;

/**
 * Real, honest display-only adapter — `PropertyObjectiveDto`'s real shape into the
 * `ObjectiveDto`-typed state this whole component already threads through many draw functions.
 * The two DTOs are field-for-field identical except `focusListings` (PROPERTY) vs `focusUnits`
 * (AUTOMOTIVE) — every real consumer in this file only ever reads
 * targetHotLeads/budgetAllocation/focusUnits/areaPriorities for DISPLAY, nothing that depends on
 * which vertical produced the row, so mapping `focusListings` -> `focusUnits` here is a real,
 * honest relabeling, not a type conflation. `PropertyObjectiveDto`'s extra `budgetSource`/
 * `activatedAt`/`completedAt` fields are simply not needed by anything this component reads.
 */
function isPropertyObjective(
  real: ObjectiveDto | PropertyObjectiveDto,
): real is PropertyObjectiveDto {
  return "focusListings" in real;
}

function toObjectiveDisplayShape(real: ObjectiveDto | PropertyObjectiveDto): ObjectiveDto {
  if (!isPropertyObjective(real)) {
    return real;
  }
  return {
    id: real.id,
    tenantId: real.tenantId,
    period: real.period,
    targetHotLeads: real.targetHotLeads,
    budgetAllocation: real.budgetAllocation,
    focusUnits: real.focusListings,
    areaPriorities: real.areaPriorities,
    status: real.status,
    createdAt: real.createdAt,
  };
}

/**
 * Log-line presentation per real `simulation_logs.step` value. `step` is NOT literally an agent
 * name for three of the six: `SETUP` is the pipeline bootstrap, `JUDGE` is the AI Judge scoring
 * pass and `REVIEW` is the human manager's stage — so those are labelled "Sistem"/"AI Judge"/
 * "Manager" rather than pretending each step is a named agent. `DONE` also reaches this map (the
 * pipeline's catch-all failure line logs with `step: "DONE"`), so it is included.
 *
 * Colors are inline hex rather than CSS-module classes because they key off runtime data; they
 * match the log panel's existing dark-surface palette (`.logLineWarn`/`.logLineError`).
 */
const LOG_STEP_META: Readonly<
  Record<string, { readonly label: string; readonly icon: string; readonly color: string }>
> = {
  SETUP: { label: "Sistem", icon: "⚙", color: "#9ca3af" },
  SAMANTHA: { label: "Samantha", icon: "📊", color: "#60a5fa" },
  KAI: { label: "Kai", icon: "🎨", color: "#c084fc" },
  CLARA: { label: "Clara", icon: "💬", color: "#34d399" },
  JUDGE: { label: "AI Judge", icon: "⚖", color: "#fbbf24" },
  REVIEW: { label: "Manager", icon: "🧑‍💼", color: "#f472b6" },
  DONE: { label: "Selesai", icon: "✅", color: "#9ca3af" },
  /** AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 4 — every log line `GoLiveService` appends (both `/go-live` and `/rollback`) uses this step, so the existing filter dropdown/log panel already isolates them, no second log UI needed. */
  GO_LIVE: { label: "Go Live", icon: "🚀", color: "#f97316" },
};

/** Unknown steps keep the raw value rather than being hidden or relabelled — an honest fallback. */
function logStepMeta(step: string): { label: string; icon: string; color: string } {
  return LOG_STEP_META[step] ?? { label: step, icon: "•", color: "#d1d5db" };
}

/** The filter dropdown's options, derived from the real steps that actually appear in this run's logs — never a hardcoded list that could offer an empty filter. */
function logStepOptions(logs: readonly SimulationLogEntryDto[]): readonly string[] {
  return [...new Set(logs.map((entry) => entry.step))];
}

function needsRefresh(ad: CampaignAdDto): boolean {
  return ad.verdict === "REFRESH" || ad.metrics.frequency >= FREQUENCY_THRESHOLD;
}

function stepIndex(step: string): number {
  const index = STEPS.indexOf(step as WizardStep);
  return index === -1 ? 0 : index;
}

function badgeClass(status: "pending" | "ok" | "warn" | "error"): string {
  switch (status) {
    case "ok":
      return `${styles.badge} ${styles.badgeOk}`;
    case "warn":
      return `${styles.badge} ${styles.badgeWarn}`;
    case "error":
      return `${styles.badge} ${styles.badgeError}`;
    default:
      return `${styles.badge} ${styles.badgePending}`;
  }
}

function verdictClass(verdict: string): string {
  switch (verdict) {
    case "GO":
      return `${styles.verdictBadge} ${styles.verdictGo}`;
    case "CONDITIONAL":
      return `${styles.verdictBadge} ${styles.verdictConditional}`;
    case "NO-GO":
      return `${styles.verdictBadge} ${styles.verdictNoGo}`;
    default:
      return `${styles.verdictBadge} ${styles.verdictIncomplete}`;
  }
}

/**
 * "Simulasi Samantha × Kai × Clara" — the 6-step dry-run wizard (Setup → Samantha → Kai → Clara →
 * AI Judge → Review) from `docs/PROMPT-AAOS-DASHBOARD-SIMULASI-TAMARA-KAI-JESSY.md`, rebuilding
 * the old 4-step client-side-only `SimulasiClient.tsx` preview.
 *
 * HARD SCOPE BOUNDARY: nothing in this component can execute a real Meta Ads change, activate
 * WhatsApp auto-reply, or touch CAPI. "Approve"/"Reject" in Step 6 only record the manager's
 * decision (`POST /api/simulation/:id/{approve,reject}`) — no `/api/verdicts` call, no campaign
 * creation. A manager who wants to act on a verdict for real already has `/meta-ads/strategi`.
 *
 * Every number/log line shown here traces back to a real `aaos-api` response
 * (`GET /api/simulation/:id/status`, itself sourced from real `/api/v1/llm/analyze`,
 * `/api/v1/llm/creative-brief`, and `apps/aaos-simulator`'s `/api/simulate`) — no fabricated
 * per-line "streaming" log, no invented Clara turns or Judge scores. Step 3's real Kie AI video
 * generation is NOT invoked in this pass (see `simulation.service.ts`'s class doc on the backend)
 * — the Kai stage card below shows the real brief plus an honest "belum tersedia" note instead of
 * a fabricated video/image preview.
 */
export function SimulationWizardClient(): React.ReactElement {
  const {
    data: campaignsData,
    loading: campaignsLoading,
    error: campaignsError,
    pull,
  } = useCampaignsSnapshot();

  const [objective, setObjective] = useState<ObjectiveDto | null | undefined>(undefined);
  const [objectiveLoading, setObjectiveLoading] = useState(true);
  const [objectiveError, setObjectiveError] = useState<string | undefined>(undefined);

  const [campaignDataSource, setCampaignDataSource] = useState<"cache" | "fresh">("cache");
  const [selectedAd, setSelectedAd] = useState<CampaignAdDto | undefined>(undefined);
  const [angle, setAngle] = useState<string>(AD_ANGLES[0]);
  const [branch, setBranch] = useState<string>(BRANCHES[0]);
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<readonly string[]>([]);

  // AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 6 — the tenant's real resolved vertical (from
  // `GET /api/settings`, Phase 1) drives Step 1's persona labels + the PROPERTY-only "Pilih
  // Listing"/angle fields below. Defaults to `undefined` while loading — every branch below treats
  // `undefined` the SAME as `"AUTOMOTIVE"` so a slow/failed fetch never changes AUTOMOTIVE's
  // today-identical behavior.
  const [vertical, setVertical] = useState<Vertical | undefined>(undefined);
  const [listings, setListings] = useState<readonly ListingDto[] | undefined>(undefined);
  const [listingsError, setListingsError] = useState<string | undefined>(undefined);
  const [selectedListingId, setSelectedListingId] = useState<string | undefined>(undefined);
  const [propertyAngle, setPropertyAngle] = useState<string>(PROPERTY_AD_ANGLES[0]);

  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | undefined>(undefined);
  const [simulationId, setSimulationId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<SimulationStatusDto | undefined>(undefined);
  const [statusError, setStatusError] = useState<string | undefined>(undefined);

  const [decisionPending, setDecisionPending] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState("");

  // AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 4 (Go Live) — dialog state. The real "GO LIVE"
  // confirmation-text check happens server-side too (`GoLiveService.execute`) — this is only the
  // client-side UX layer (coordinator note section 6).
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [goLiveConfirmText, setGoLiveConfirmText] = useState("");
  const [goLiveDailyBudget, setGoLiveDailyBudget] = useState("50000");
  const [goLiveAssetType, setGoLiveAssetType] = useState<"VIDEO" | "IMAGE">("IMAGE");
  const [goLiveHostedUrl, setGoLiveHostedUrl] = useState("");
  const [goLiveThumbnailUrl, setGoLiveThumbnailUrl] = useState("");
  const [goLivePrimaryText, setGoLivePrimaryText] = useState("");
  const [goLivePending, setGoLivePending] = useState(false);
  const [goLiveError, setGoLiveError] = useState<string | undefined>(undefined);
  const [rollbackPending, setRollbackPending] = useState(false);
  const [rollbackError, setRollbackError] = useState<string | undefined>(undefined);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<readonly SimulationHistoryEntryDto[] | undefined>(
    undefined,
  );
  const [historyLoading, setHistoryLoading] = useState(false);

  // AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 3, section D — the history detail modal's own
  // fetched state, independent of the live `status` above (a past run's full `SimulationStatusDto`,
  // fetched on demand from the same real `GET /api/v1/simulation/:id/status` this page already
  // polls for the in-progress run).
  const [historyDetailId, setHistoryDetailId] = useState<string | undefined>(undefined);
  const [historyDetail, setHistoryDetail] = useState<SimulationStatusDto | undefined>(undefined);
  const [historyDetailError, setHistoryDetailError] = useState<string | undefined>(undefined);
  const [historyDetailTab, setHistoryDetailTab] = useState<"SCORES" | "CAMPAIGN" | "KAI" | "LOG">(
    "SCORES",
  );

  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setObjectiveLoading(true);
    // Real bug fix: this used to parse `res.json()` unconditionally and read `body.objective` off
    // it — on any non-2xx response (route error, not "no objective set") the body is shaped
    // `{ error: { message } }` instead, so `body.objective` silently came back `undefined`. Both
    // JSX branches below only handle `null`/a real `ObjectiveDto`, so `undefined` rendered
    // NOTHING — Step 1 looked like the objective section had vanished, with no error shown either.
    //
    // Real user-reported bug fix (post-ship): this always fetched `/api/objective` — the AUTOMOTIVE-
    // only `objective-engine` endpoint — even for PROPERTY tenants, who set their real objective via
    // the genuinely separate `/api/property-objective` endpoint (Phase O1/O2,
    // `docs/PROMPT-AAOS-TENANT-SCOPING-AND-PROPERTY-OBJECTIVE.md`). Step 1 correctly showed "Belum ada
    // objective bulan ini" for a PROPERTY tenant who HAD set one, because it was checking the wrong
    // store. Now branches on the real resolved `vertical` and adapts `PropertyObjectiveDto`'s real
    // shape into this component's existing `ObjectiveDto`-typed state (the two DTOs are field-for-
    // field identical except `focusListings` vs `focusUnits` — a real, honest display-only mapping,
    // not a type conflation, since every consumer in this file only ever reads
    // targetHotLeads/budgetAllocation/focusUnits/areaPriorities for display).
    //
    // Keyed on `[vertical]` (not `[]`): runs once immediately with `vertical` still `undefined`
    // (fetches the AUTOMOTIVE endpoint, matching this component's own established "unresolved =
    // treated as AUTOMOTIVE" convention elsewhere), then re-runs and re-fetches the real PROPERTY
    // endpoint once `vertical` resolves to `"PROPERTY"` — a real, accepted one-time extra call for
    // PROPERTY tenants during the brief unresolved window, the SAME tradeoff `ObjectiveClient.tsx`'s
    // own vertical-resolution effect already documents accepting.
    const endpoint = vertical === "PROPERTY" ? "/api/property-objective" : "/api/objective";
    fetch(endpoint)
      .then(async (res) => {
        const body = (await res.json()) as {
          objective?: (ObjectiveDto | PropertyObjectiveDto) | null;
          error?: { message?: string };
        };
        if (cancelled) {
          return;
        }
        if (!res.ok) {
          setObjectiveError(body.error?.message ?? "Gagal memuat objective.");
          setObjective(null);
          return;
        }
        const real = body.objective ?? null;
        setObjective(real === null ? null : toObjectiveDisplayShape(real));
      })
      .catch(() => {
        if (!cancelled) {
          setObjectiveError("Gagal memuat objective.");
          setObjective(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setObjectiveLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [vertical]);

  // AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 6 — resolves the tenant's real vertical once, the
  // same real `GET /api/settings` route Phase 1's tenant Settings page already uses. A fetch
  // failure degrades to `undefined` (treated as AUTOMOTIVE everywhere below), never blocks Step 1.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then(async (res) => {
        if (!res.ok || cancelled) {
          return;
        }
        const body = (await res.json()) as SettingsDto;
        if (!cancelled) {
          setVertical(body.tenant.vertical);
        }
      })
      .catch(() => {
        /* honest no-op — vertical stays undefined, treated as AUTOMOTIVE below */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 6 — Step 1's "Pilih Listing" dropdown, sourced
  // from the real `GET /api/listings?status=AKTIF` (Phase 2), fetched only once `vertical` resolves
  // to PROPERTY (never fetched for AUTOMOTIVE tenants).
  useEffect(() => {
    if (vertical !== "PROPERTY") {
      return;
    }
    let cancelled = false;
    setListingsError(undefined);
    fetch("/api/listings?status=AKTIF")
      .then(async (res) => {
        if (cancelled) {
          return;
        }
        if (!res.ok) {
          const body = (await res.json()) as { error?: { message?: string } };
          setListingsError(body.error?.message ?? "Gagal memuat listing.");
          return;
        }
        const body = (await res.json()) as ListingListDto;
        setListings(body.listings);
      })
      .catch(() => {
        if (!cancelled) {
          setListingsError("Gagal memuat listing.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [vertical]);

  useEffect(() => {
    if (simulationId === undefined) {
      return;
    }
    async function poll(): Promise<void> {
      try {
        const res = await fetch(`/api/simulation/${simulationId}/status`);
        if (!res.ok) {
          const body = (await res.json()) as { error?: { message?: string } };
          setStatusError(body.error?.message ?? "Gagal memuat status simulasi.");
          return;
        }
        const body = (await res.json()) as SimulationStatusDto;
        setStatus(body);
        setStatusError(undefined);
        if (body.status !== "RUNNING" && pollRef.current !== undefined) {
          clearInterval(pollRef.current);
          pollRef.current = undefined;
        }
      } catch {
        setStatusError("Gagal memuat status simulasi.");
      }
    }
    void poll();
    pollRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current !== undefined) {
        clearInterval(pollRef.current);
        pollRef.current = undefined;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-runs only when simulationId changes; `poll` itself always reads the latest `simulationId` via closure.
  }, [simulationId]);

  function togglePersona(id: string): void {
    setSelectedPersonaIds((current) =>
      current.includes(id) ? current.filter((p) => p !== id) : [...current, id],
    );
  }

  async function startSimulation(): Promise<void> {
    if (selectedAd === undefined || selectedPersonaIds.length === 0) {
      return;
    }
    // AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 6 — a PROPERTY tenant must pick a real listing
    // before Step 3 can build a real Kai prompt (`kai-prompt-preview.ts`'s PROPERTY branch needs
    // `listingId`/`kaiPropertyAngle`) — same "don't start with a gap we already know about" guard
    // the ad/persona checks above already apply.
    if (vertical === "PROPERTY" && selectedListingId === undefined) {
      return;
    }
    setStarting(true);
    setStartError(undefined);
    try {
      const res = await fetch("/api/simulation/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          objective: objective ?? {},
          campaignDataSource,
          campaigns: campaignsData?.campaigns ?? [],
          totals: campaignsData?.totals,
          kaiAd: {
            name: selectedAd.name,
            branch: selectedAd.branch,
            metrics: {
              spend: selectedAd.metrics.spend,
              frequency: selectedAd.metrics.frequency,
              totalLead: selectedAd.metrics.totalLead,
            },
          },
          kaiAngle: angle,
          kaiBranch: selectedAd.branch,
          personaIds: selectedPersonaIds,
          branch,
          ...(vertical === "PROPERTY"
            ? { listingId: selectedListingId, kaiPropertyAngle: propertyAngle }
            : {}),
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: { message?: string } };
        setStartError(body.error?.message ?? "Gagal memulai simulasi.");
        return;
      }
      const body = (await res.json()) as { id: string };
      setSimulationId(body.id);
      setStatus(undefined);
    } catch {
      setStartError("Gagal memulai simulasi.");
    } finally {
      setStarting(false);
    }
  }

  async function decide(decision: "approve" | "reject"): Promise<void> {
    if (simulationId === undefined) {
      return;
    }
    setDecisionPending(true);
    try {
      const res = await fetch(`/api/simulation/${simulationId}/${decision}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes: decisionNotes.length > 0 ? decisionNotes : undefined }),
      });
      if (res.ok) {
        const body = (await res.json()) as SimulationStatusDto;
        setStatus(body);
      }
    } finally {
      setDecisionPending(false);
    }
  }

  /**
   * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 4 — submits `POST /api/simulation/:id/go-live`.
   * On success/failure alike, refetches this simulation's real `status` so the SAME `LogPanel`
   * already rendered below immediately shows every real `GO_LIVE`-step log line the server just
   * appended (dry-run or real) — no separate polling/log UI for Go Live.
   */
  async function submitGoLive(): Promise<void> {
    if (simulationId === undefined) {
      return;
    }
    setGoLivePending(true);
    setGoLiveError(undefined);
    try {
      const res = await fetch(`/api/simulation/${simulationId}/go-live`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirmation: goLiveConfirmText,
          dailyBudgetIDR: Number(goLiveDailyBudget),
          creative:
            goLiveAssetType === "VIDEO"
              ? {
                  assetType: "VIDEO",
                  hostedUrl: goLiveHostedUrl,
                  thumbnailUrl: goLiveThumbnailUrl,
                  primaryText: goLivePrimaryText,
                }
              : { assetType: "IMAGE", hostedUrl: goLiveHostedUrl, primaryText: goLivePrimaryText },
        }),
      });
      const body = (await res.json()) as SimulationStatusDto & { error?: { message?: string } };
      if (!res.ok) {
        setGoLiveError(body.error?.message ?? "Go Live gagal.");
        // Refetch anyway — a guard failure still appends nothing, but a mid-sequence failure
        // logs real GO_LIVE lines the operator needs to see.
        const statusRes = await fetch(`/api/simulation/${simulationId}/status`);
        if (statusRes.ok) {
          setStatus((await statusRes.json()) as SimulationStatusDto);
        }
        return;
      }
      setStatus(body);
      setGoLiveOpen(false);
      setGoLiveConfirmText("");
    } catch {
      setGoLiveError("Go Live gagal.");
    } finally {
      setGoLivePending(false);
    }
  }

  /** AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 4 — submits `POST /api/simulation/:id/rollback`; the real rollback-window check is server-side. */
  async function submitRollback(): Promise<void> {
    if (simulationId === undefined) {
      return;
    }
    setRollbackPending(true);
    setRollbackError(undefined);
    try {
      const res = await fetch(`/api/simulation/${simulationId}/rollback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as SimulationStatusDto & { error?: { message?: string } };
      if (!res.ok) {
        setRollbackError(body.error?.message ?? "Rollback gagal.");
        return;
      }
      setStatus(body);
    } catch {
      setRollbackError("Rollback gagal.");
    } finally {
      setRollbackPending(false);
    }
  }

  async function loadHistory(): Promise<void> {
    setHistoryOpen((open) => !open);
    if (history !== undefined) {
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/simulation/history");
      const body = (await res.json()) as { history?: readonly SimulationHistoryEntryDto[] };
      setHistory(body.history ?? []);
    } finally {
      setHistoryLoading(false);
    }
  }

  /** "Lihat →" on a history row — fetches that run's real full status once, then opens the detail modal. */
  async function openHistoryDetail(id: string): Promise<void> {
    setHistoryDetailId(id);
    setHistoryDetail(undefined);
    setHistoryDetailError(undefined);
    setHistoryDetailTab("SCORES");
    try {
      const res = await fetch(`/api/simulation/${id}/status`);
      if (!res.ok) {
        const body = (await res.json()) as { error?: { message?: string } };
        setHistoryDetailError(body.error?.message ?? "Gagal memuat detail simulasi.");
        return;
      }
      const body = (await res.json()) as SimulationStatusDto;
      setHistoryDetail(body);
    } catch {
      setHistoryDetailError("Gagal memuat detail simulasi.");
    }
  }

  function closeHistoryDetail(): void {
    setHistoryDetailId(undefined);
    setHistoryDetail(undefined);
    setHistoryDetailError(undefined);
  }

  // Real bug fix: this used to be `.filter(needsRefresh)` — when no cached ad happened to need a
  // refresh, the list was permanently empty, `selectedAd` could never be set, and "Mulai Simulasi
  // Dry-Run" stayed disabled forever with no way out. Kai's brief step just needs SOME real ad to
  // brief on, not specifically one that needs refreshing — so every real ad is selectable, with
  // ones that DO need a refresh sorted first (still visually flagged) rather than being the only
  // ones offered.
  const candidates = [...(campaignsData?.ads ?? [])].sort(
    (a, b) => Number(needsRefresh(b)) - Number(needsRefresh(a)),
  );
  const currentStep = status !== undefined ? stepIndex(status.currentStep) : 0;

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>🎬 Simulasi Samantha × Kai × Clara</h2>
          <p className={styles.subtitle}>
            Dry-run 6 langkah — preview & skor rencana campaign sebelum GO LIVE.
          </p>
        </div>
        <button type="button" onClick={() => void loadHistory()} className={styles.secondaryButton}>
          {historyOpen ? "Tutup Riwayat" : "Riwayat"}
        </button>
      </div>

      {historyOpen ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Riwayat Simulasi</h3>
          {historyLoading ? <LoadingSpinner /> : null}
          {!historyLoading && (history?.length ?? 0) === 0 ? (
            <p className={styles.mutedText}>Belum ada simulasi yang pernah dijalankan.</p>
          ) : null}
          <div className={styles.historyTable}>
            {(history ?? []).map((entry) => (
              <div key={entry.id} className={styles.historyRow}>
                <span>{entry.id.slice(0, 8)}</span>
                <span>{entry.status}</span>
                <span>
                  {entry.overallScore !== undefined
                    ? `${entry.overallScore} (${entry.grade})`
                    : "—"}
                </span>
                <span>{entry.decision ?? "—"}</span>
                <span>{new Date(entry.createdAt).toLocaleString("id-ID")}</span>
                <button
                  type="button"
                  onClick={() => void openHistoryDetail(entry.id)}
                  className={styles.secondaryButton}
                >
                  Lihat →
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className={styles.stepBar}>
        {STEPS.map((step, index) => (
          <span
            key={step}
            className={`${styles.stepPill} ${
              index === currentStep && status?.status === "RUNNING"
                ? styles.stepPillActive
                : index < currentStep || status?.status === "DONE" || status?.status === "ERROR"
                  ? styles.stepPillDone
                  : ""
            }`}
          >
            {index + 1}. {step}
          </span>
        ))}
      </div>

      {/* Step 1: Setup */}
      <section data-testid="wizard-step-setup" className={styles.section}>
        <h3 className={styles.sectionTitle}>Step 1 — Setup</h3>

        {objectiveLoading ? <LoadingSpinner /> : null}
        {!objectiveLoading && objectiveError !== undefined ? (
          <ErrorCard message={objectiveError} />
        ) : null}
        {!objectiveLoading && objectiveError === undefined && objective === null ? (
          <p className={styles.mutedText}>
            Belum ada objective bulan ini — atur di halaman Objective.
          </p>
        ) : null}
        {!objectiveLoading && objective !== null && objective !== undefined ? (
          <p className={styles.rowText}>
            Target {objective.targetHotLeads} hot leads · Budget Rp{" "}
            {objective.budgetAllocation.toLocaleString("id-ID")} · Fokus:{" "}
            {objective.focusUnits.join(", ") || "-"}
          </p>
        ) : null}

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Sumber data campaign</label>
          <select
            value={campaignDataSource}
            onChange={(event) => setCampaignDataSource(event.target.value as "cache" | "fresh")}
            className={styles.select}
          >
            <option value="cache">Pakai cache yang ada</option>
            <option value="fresh">Tarik data terbaru</option>
          </select>
          {campaignDataSource === "fresh" ? (
            <button type="button" onClick={() => void pull()} className={styles.secondaryButton}>
              Tarik data sekarang
            </button>
          ) : null}
        </div>

        {campaignsLoading ? <LoadingSpinner /> : null}
        {!campaignsLoading && campaignsError !== undefined ? (
          <ErrorCard message={campaignsError} />
        ) : null}
        {!campaignsLoading && campaignsData === undefined ? (
          <EmptyState
            title="Belum ada data"
            description="Tarik data di halaman Data Iklan terlebih dahulu."
          />
        ) : null}

        {campaignsData !== undefined ? (
          <>
            <p className={styles.formLabel}>
              Pilih iklan untuk brief Kai (yang butuh REFRESH ditandai)
            </p>
            {candidates.length === 0 ? (
              <p className={styles.mutedText}>
                Belum ada data iklan — tarik data di halaman Data Iklan.
              </p>
            ) : (
              <div className={styles.list}>
                {candidates.map((ad) => (
                  <button
                    key={ad.id}
                    type="button"
                    onClick={() => {
                      setSelectedAd(ad);
                      setBranch(ad.branch);
                    }}
                    className={`${styles.row} ${selectedAd?.id === ad.id ? styles.rowSelected : ""}`}
                  >
                    <span className={styles.rowText}>
                      {needsRefresh(ad) ? "⚠ " : ""}
                      {ad.stableId} {ad.name} · {ad.verdict} · freq{" "}
                      {ad.metrics.frequency.toFixed(1)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {vertical === "PROPERTY" ? (
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Angle creative (Kai)</label>
                <select
                  value={propertyAngle}
                  onChange={(event) => setPropertyAngle(event.target.value)}
                  className={styles.select}
                >
                  {PROPERTY_AD_ANGLES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Angle creative (Kai)</label>
                <select
                  value={angle}
                  onChange={(event) => setAngle(event.target.value)}
                  className={styles.select}
                >
                  {AD_ANGLES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 6 — Step 1's "Pilih Listing" (spec
                Document 1 Part 5/Document 2 section E), PROPERTY tenants only. Sourced from the real
                GET /api/listings?status=AKTIF (Phase 2) — never AUTOMOTIVE's ad-based flow. */}
            {vertical === "PROPERTY" ? (
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Pilih Listing</label>
                {listingsError !== undefined ? <ErrorCard message={listingsError} /> : null}
                {listingsError === undefined && listings === undefined ? <LoadingSpinner /> : null}
                {listingsError === undefined && listings !== undefined && listings.length === 0 ? (
                  <p className={styles.mutedText}>
                    Belum ada listing AKTIF — tambahkan di Listing Manager.
                  </p>
                ) : null}
                {listings !== undefined && listings.length > 0 ? (
                  <select
                    value={selectedListingId ?? ""}
                    onChange={(event) => setSelectedListingId(event.target.value || undefined)}
                    className={styles.select}
                  >
                    <option value="">— pilih listing —</option>
                    {listings.map((listing) => (
                      <option key={listing.id} value={listing.id}>
                        {listing.title}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            ) : null}

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Persona Clara (pilih minimal 1)</label>
              <div className={styles.personaGrid}>
                {PERSONAS.map((persona) => (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => togglePersona(persona.id)}
                    className={`${styles.personaChip} ${
                      selectedPersonaIds.includes(persona.id) ? styles.personaChipSelected : ""
                    }`}
                  >
                    {vertical === "PROPERTY"
                      ? (PROPERTY_PERSONA_LABELS[persona.id] ?? persona.label)
                      : persona.label}
                  </button>
                ))}
              </div>
            </div>

            {startError !== undefined ? <ErrorCard message={startError} /> : null}

            <button
              type="button"
              onClick={() => void startSimulation()}
              disabled={
                starting ||
                selectedAd === undefined ||
                selectedPersonaIds.length === 0 ||
                (vertical === "PROPERTY" && selectedListingId === undefined)
              }
              className={styles.primaryButton}
            >
              {starting ? "Memulai…" : "Mulai Simulasi Dry-Run"}
            </button>
          </>
        ) : null}
      </section>

      {/* Steps 2-5: live pipeline status */}
      {simulationId !== undefined ? (
        <section data-testid="wizard-pipeline" className={styles.section}>
          <h3 className={styles.sectionTitle}>Pipeline — {simulationId.slice(0, 8)}</h3>
          {statusError !== undefined ? <ErrorCard message={statusError} /> : null}
          {status === undefined ? <LoadingSpinner /> : null}

          {status !== undefined ? (
            <div className={styles.stageGrid}>
              <SamanthaStageCard status={status} objective={objective} />
              <KaiStageCard status={status} />
              <ClaraStageCard status={status} />
            </div>
          ) : null}

          {status !== undefined && status.logs.length > 0 ? <LogPanel logs={status.logs} /> : null}
        </section>
      ) : null}

      {/* Step 6: Review & Approve */}
      {status?.result !== undefined ? (
        <section data-testid="wizard-step-review" className={styles.section}>
          <h3 className={styles.sectionTitle}>Step 6 — Review &amp; Approve</h3>
          <div className={styles.scoreCard}>
            <span className={styles.scoreBig}>{status.result.scoring.overallScore}</span>
            <div className={styles.scoreBreakdown}>
              <span>Grade {status.result.scoring.grade}</span>
              <span>
                Samantha {status.result.scoring.samanthaCoverageScore} · Kai{" "}
                {status.result.scoring.kaiScore} · Clara{" "}
                {status.result.scoring.claraScore.toFixed(1)}
              </span>
            </div>
            <span className={verdictClass(status.result.scoring.verdict)}>
              {status.result.scoring.verdict}
            </span>
          </div>

          {status.decision === undefined ? (
            <>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Catatan (opsional)</label>
                <input
                  type="text"
                  value={decisionNotes}
                  onChange={(event) => setDecisionNotes(event.target.value)}
                  className={styles.select}
                  placeholder="Catatan untuk riwayat…"
                />
              </div>
              <div className={styles.formRow} style={{ flexDirection: "row", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => void decide("approve")}
                  disabled={decisionPending}
                  className={styles.primaryButton}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => void decide("reject")}
                  disabled={decisionPending}
                  className={styles.secondaryButton}
                >
                  Reject
                </button>
              </div>
              <p className={styles.mutedText}>
                Approve/Reject hanya mencatat keputusan pada riwayat simulasi ini — tidak membuat
                campaign Meta, tidak mengaktifkan WhatsApp/CAPI. Untuk eksekusi verdict yang
                sesungguhnya, gunakan halaman Strategi.
              </p>
            </>
          ) : (
            <p className={styles.rowText}>
              Keputusan tercatat: <strong>{status.decision}</strong>
              {status.decisionNotes !== undefined ? ` — ${status.decisionNotes}` : ""}
            </p>
          )}

          {/* AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 4 — the Go Live button is visible ONLY once decision is real APPROVED. */}
          {status.decision === "APPROVED" && status.status === "DONE" ? (
            <div className={styles.formRow} style={{ marginTop: 12 }}>
              <button
                type="button"
                data-testid="go-live-button"
                onClick={() => setGoLiveOpen(true)}
                className={styles.primaryButton}
              >
                🚀 Go Live
              </button>
            </div>
          ) : null}

          {status.status === "LIVE" ? (
            <div className={styles.formRow} style={{ marginTop: 12 }} data-testid="go-live-status">
              <p className={styles.rowText}>
                🚀 <strong>LIVE</strong> — campaignId {status.liveCampaignId}, adId{" "}
                {status.liveAdId}
                {status.liveAt !== undefined
                  ? ` sejak ${new Date(status.liveAt).toLocaleString("id-ID")}`
                  : ""}
              </p>
              <button
                type="button"
                data-testid="rollback-button"
                onClick={() => void submitRollback()}
                disabled={rollbackPending}
                className={styles.secondaryButton}
              >
                ↩ Rollback
              </button>
              {rollbackError !== undefined ? <ErrorCard message={rollbackError} /> : null}
            </div>
          ) : null}

          {status.status === "ROLLED_BACK" ? (
            <p className={styles.rowText}>
              ↩ Campaign sudah di-rollback
              {status.rolledBackAt !== undefined
                ? ` pada ${new Date(status.rolledBackAt).toLocaleString("id-ID")}`
                : ""}
              .
            </p>
          ) : null}
        </section>
      ) : null}

      {goLiveOpen ? (
        <GoLiveDialog
          confirmText={goLiveConfirmText}
          onConfirmTextChange={setGoLiveConfirmText}
          dailyBudget={goLiveDailyBudget}
          onDailyBudgetChange={setGoLiveDailyBudget}
          assetType={goLiveAssetType}
          onAssetTypeChange={setGoLiveAssetType}
          hostedUrl={goLiveHostedUrl}
          onHostedUrlChange={setGoLiveHostedUrl}
          thumbnailUrl={goLiveThumbnailUrl}
          onThumbnailUrlChange={setGoLiveThumbnailUrl}
          primaryText={goLivePrimaryText}
          onPrimaryTextChange={setGoLivePrimaryText}
          pending={goLivePending}
          error={goLiveError}
          onCancel={() => setGoLiveOpen(false)}
          onSubmit={() => void submitGoLive()}
        />
      ) : null}

      {status?.status === "ERROR" ? (
        <ErrorCard message={status.errorMessage ?? "Simulasi gagal."} />
      ) : null}

      {historyDetailId !== undefined ? (
        <HistoryDetailModal
          detail={historyDetail}
          error={historyDetailError}
          tab={historyDetailTab}
          onTabChange={setHistoryDetailTab}
          onClose={closeHistoryDetail}
          objective={objective}
        />
      ) : null}
    </div>
  );
}

const HISTORY_DETAIL_TABS: ReadonlyArray<{
  readonly id: "SCORES" | "CAMPAIGN" | "KAI" | "LOG";
  readonly label: string;
}> = [
  { id: "SCORES", label: "Scores" },
  { id: "CAMPAIGN", label: "Campaign Detail" },
  { id: "KAI", label: "Kai Prompt" },
  { id: "LOG", label: "Log" },
];

const GO_LIVE_CONFIRMATION_TEXT = "GO LIVE";

/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 4 — the "🚀 Go Live" confirmation dialog. Requires
 * typing the literal string "GO LIVE" (client-side UX layer only — the real enforcement is
 * server-side in `GoLiveService.execute`, coordinator note section 6) plus the real inputs
 * `POST /api/v1/simulation/:id/go-live` needs: a daily budget and the creative asset (a real,
 * already-hosted GCS video/image URL from the Simulasi wizard's already-generated creative
 * package — this dialog does not upload anything itself).
 */
function GoLiveDialog({
  confirmText,
  onConfirmTextChange,
  dailyBudget,
  onDailyBudgetChange,
  assetType,
  onAssetTypeChange,
  hostedUrl,
  onHostedUrlChange,
  thumbnailUrl,
  onThumbnailUrlChange,
  primaryText,
  onPrimaryTextChange,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  readonly confirmText: string;
  readonly onConfirmTextChange: (value: string) => void;
  readonly dailyBudget: string;
  readonly onDailyBudgetChange: (value: string) => void;
  readonly assetType: "VIDEO" | "IMAGE";
  readonly onAssetTypeChange: (value: "VIDEO" | "IMAGE") => void;
  readonly hostedUrl: string;
  readonly onHostedUrlChange: (value: string) => void;
  readonly thumbnailUrl: string;
  readonly onThumbnailUrlChange: (value: string) => void;
  readonly primaryText: string;
  readonly onPrimaryTextChange: (value: string) => void;
  readonly pending: boolean;
  readonly error: string | undefined;
  readonly onCancel: () => void;
  readonly onSubmit: () => void;
}): React.ReactElement {
  const canSubmit =
    confirmText === GO_LIVE_CONFIRMATION_TEXT &&
    hostedUrl.length > 0 &&
    primaryText.length > 0 &&
    (assetType === "IMAGE" || thumbnailUrl.length > 0) &&
    Number(dailyBudget) > 0 &&
    !pending;

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      data-testid="go-live-dialog"
    >
      <div className={styles.modalPanel}>
        <div className={styles.headerRow}>
          <h3 className={styles.sectionTitle}>🚀 Konfirmasi Go Live</h3>
          <button type="button" onClick={onCancel} className={styles.secondaryButton}>
            Batal
          </button>
        </div>

        <p className={styles.mutedText}>
          Ini akan membuat Campaign+AdSet+Ad NYATA di Meta Ads (atau, jika mode dry-run aktif di
          server, hanya mencatat log simulasi tanpa panggilan API nyata). Ketik{" "}
          <strong>{GO_LIVE_CONFIRMATION_TEXT}</strong> untuk melanjutkan.
        </p>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Ketik &quot;{GO_LIVE_CONFIRMATION_TEXT}&quot;</label>
          <input
            type="text"
            data-testid="go-live-confirm-input"
            value={confirmText}
            onChange={(event) => onConfirmTextChange(event.target.value)}
            className={styles.select}
            placeholder={GO_LIVE_CONFIRMATION_TEXT}
          />
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Budget harian (Rp)</label>
          <input
            type="number"
            min={1}
            value={dailyBudget}
            onChange={(event) => onDailyBudgetChange(event.target.value)}
            className={styles.select}
          />
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Tipe creative</label>
          <select
            value={assetType}
            onChange={(event) => onAssetTypeChange(event.target.value as "VIDEO" | "IMAGE")}
            className={styles.select}
          >
            <option value="IMAGE">Gambar</option>
            <option value="VIDEO">Video</option>
          </select>
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>URL creative (sudah ter-hosting di GCS)</label>
          <input
            type="text"
            value={hostedUrl}
            onChange={(event) => onHostedUrlChange(event.target.value)}
            className={styles.select}
            placeholder="https://storage.googleapis.com/aaos/…"
          />
        </div>

        {assetType === "VIDEO" ? (
          <div className={styles.formRow}>
            <label className={styles.formLabel}>URL thumbnail (untuk video_data.image_url)</label>
            <input
              type="text"
              value={thumbnailUrl}
              onChange={(event) => onThumbnailUrlChange(event.target.value)}
              className={styles.select}
              placeholder="https://storage.googleapis.com/aaos/…thumb.jpg"
            />
          </div>
        ) : null}

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Primary text</label>
          <input
            type="text"
            value={primaryText}
            onChange={(event) => onPrimaryTextChange(event.target.value)}
            className={styles.select}
          />
        </div>

        {error !== undefined ? <ErrorCard message={error} /> : null}

        <div className={styles.formRow} style={{ flexDirection: "row", gap: 8 }}>
          <button
            type="button"
            data-testid="go-live-confirm-button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className={styles.primaryButton}
          >
            {pending ? "Memproses…" : "🚀 Go Live Sekarang"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 3, section D — the History table's new "Lihat →"
 * detail modal. Reuses the exact same real components the live pipeline view already renders
 * (`CampaignPreview`, `KaiPromptPreview`, `LogPanel`) over a past run's real, fetched
 * `SimulationStatusDto` — no new data path, no re-derived summary.
 */
function HistoryDetailModal({
  detail,
  error,
  tab,
  onTabChange,
  onClose,
  objective,
}: {
  readonly detail: SimulationStatusDto | undefined;
  readonly error: string | undefined;
  readonly tab: "SCORES" | "CAMPAIGN" | "KAI" | "LOG";
  readonly onTabChange: (tab: "SCORES" | "CAMPAIGN" | "KAI" | "LOG") => void;
  readonly onClose: () => void;
  readonly objective: ObjectiveDto | null | undefined;
}): React.ReactElement {
  const scoring = detail?.result?.scoring;
  const targeting = detail?.result?.samantha.audienceTargeting;
  const promptDetail = detail?.result?.kai.promptDetail;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalPanel}>
        <div className={styles.headerRow}>
          <h3 className={styles.sectionTitle}>
            Detail Simulasi {detail !== undefined ? detail.id.slice(0, 8) : "…"}
          </h3>
          <button type="button" onClick={onClose} className={styles.secondaryButton}>
            Tutup
          </button>
        </div>

        {error !== undefined ? <ErrorCard message={error} /> : null}
        {error === undefined && detail === undefined ? <LoadingSpinner /> : null}

        {detail !== undefined ? (
          <>
            <div className={styles.stepBar}>
              {HISTORY_DETAIL_TABS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onTabChange(option.id)}
                  className={`${styles.stepPill} ${tab === option.id ? styles.stepPillActive : ""}`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {tab === "SCORES" ? (
              scoring !== undefined ? (
                <div className={styles.formRow}>
                  <div className={styles.scoreCard}>
                    <span className={styles.scoreBig}>{scoring.overallScore}</span>
                    <div className={styles.scoreBreakdown}>
                      <span>Grade {scoring.grade}</span>
                      <span>Verdict {scoring.verdict}</span>
                    </div>
                  </div>
                  <ScoreRadarChart scoring={scoring} />
                </div>
              ) : (
                <p className={styles.mutedText}>Simulasi ini belum punya hasil skor.</p>
              )
            ) : null}

            {tab === "CAMPAIGN" ? (
              targeting !== undefined ? (
                <CampaignPreview targeting={targeting} objective={objective} />
              ) : (
                <p className={styles.mutedText}>
                  Tidak ada preview campaign untuk simulasi ini (tahap Samantha tidak tersedia).
                </p>
              )
            ) : null}

            {tab === "KAI" ? (
              promptDetail !== undefined ? (
                <KaiPromptPreview detail={promptDetail} />
              ) : (
                <p className={styles.mutedText}>Tidak ada detail prompt Kai untuk simulasi ini.</p>
              )
            ) : null}

            {tab === "LOG" ? <LogPanel logs={detail.logs} /> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

const RADAR_AXES: ReadonlyArray<{
  readonly key: "samanthaCoverageScore" | "kaiScore" | "claraScore";
  readonly label: string;
  readonly max: number;
}> = [
  { key: "samanthaCoverageScore", label: "Samantha", max: 100 },
  { key: "kaiScore", label: "Kai", max: 100 },
  { key: "claraScore", label: "Clara", max: 100 },
];

const RADAR_SIZE = 160;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 60;

/**
 * A dependency-free inline-SVG radar chart over the 3 REAL per-stage scores
 * (`SimulationScoringDto.samanthaCoverageScore`/`kaiScore`/`claraScore`) — no chart library in this
 * app today, and 3 real axes is an honest triangle, not a fabricated 4th/5th dimension to make it
 * look more like a "radar". `claraScore` (0-100 already per `domain/scoring.ts`) shares the same
 * 0-100 scale as the other two, so all 3 axes use one radius mapping.
 */
function ScoreRadarChart({
  scoring,
}: {
  readonly scoring: NonNullable<SimulationStatusDto["result"]>["scoring"];
}): React.ReactElement {
  const points = RADAR_AXES.map((axis, index) => {
    const angle = (Math.PI * 2 * index) / RADAR_AXES.length - Math.PI / 2;
    const value = Math.max(0, Math.min(axis.max, scoring[axis.key]));
    const r = (value / axis.max) * RADAR_RADIUS;
    return {
      x: RADAR_CENTER + r * Math.cos(angle),
      y: RADAR_CENTER + r * Math.sin(angle),
      labelX: RADAR_CENTER + (RADAR_RADIUS + 14) * Math.cos(angle),
      labelY: RADAR_CENTER + (RADAR_RADIUS + 14) * Math.sin(angle),
      label: axis.label,
      value,
    };
  });
  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg
      data-testid="score-radar-chart"
      width={RADAR_SIZE}
      height={RADAR_SIZE}
      viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
      role="img"
      aria-label={`Radar skor: ${points.map((p) => `${p.label} ${p.value}`).join(", ")}`}
    >
      <circle
        cx={RADAR_CENTER}
        cy={RADAR_CENTER}
        r={RADAR_RADIUS}
        fill="none"
        stroke="var(--gray-300)"
      />
      <polygon points={polygonPoints} fill="rgba(0,0,0,0.15)" stroke="var(--black)" />
      {points.map((p) => (
        <text key={p.label} x={p.labelX} y={p.labelY} fontSize={10} textAnchor="middle">
          {p.label} {p.value}
        </text>
      ))}
    </svg>
  );
}

/**
 * The pipeline log panel. Reads the SAME polled `status.logs` array the wizard already fetches
 * every 3s from `GET /api/simulation/:id/status` — deliberately NOT a Supabase Realtime
 * subscription: this codebase has no Realtime precedent, and a direct browser→Supabase channel
 * would bypass the "dashboard proxies everything through aaos-api" rule. Filtering and coloring
 * are pure client-side presentation over data that was already being fetched.
 *
 * "Lihat data" appears only on lines that really carry a `payload` (today: the audience-targeting
 * step, the sole writer of `simulation_logs.payload`) — never an empty expander.
 */
function LogPanel({
  logs,
}: {
  readonly logs: readonly SimulationLogEntryDto[];
}): React.ReactElement {
  const [stepFilter, setStepFilter] = useState<string>("ALL");
  const [expanded, setExpanded] = useState<readonly string[]>([]);

  const options = logStepOptions(logs);
  const visible = stepFilter === "ALL" ? logs : logs.filter((entry) => entry.step === stepFilter);

  function toggle(key: string): void {
    setExpanded((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );
  }

  return (
    <div data-testid="simulation-log-panel">
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Filter log per agent/tahap</label>
        <select
          data-testid="log-step-filter"
          value={stepFilter}
          onChange={(event) => setStepFilter(event.target.value)}
          className={styles.select}
        >
          <option value="ALL">Semua ({logs.length})</option>
          {options.map((step) => (
            <option key={step} value={step}>
              {logStepMeta(step).icon} {logStepMeta(step).label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.logPanel}>
        {visible.length === 0 ? (
          <p className={styles.logLine}>Tidak ada log untuk filter ini.</p>
        ) : null}
        {visible.map((entry, index) => {
          const key = `${entry.createdAt}-${index}`;
          const meta = logStepMeta(entry.step);
          const isOpen = expanded.includes(key);
          return (
            <div key={key}>
              <p
                className={`${styles.logLine} ${
                  entry.level === "WARN"
                    ? styles.logLineWarn
                    : entry.level === "ERROR"
                      ? styles.logLineError
                      : ""
                }`}
              >
                [{new Date(entry.createdAt).toLocaleTimeString("id-ID")}]{" "}
                <span style={{ color: meta.color, fontWeight: 600 }}>
                  {meta.icon} {meta.label}
                </span>
                : {entry.message}
                {entry.payload !== undefined ? (
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className={styles.logDataToggle}
                  >
                    {isOpen ? "Sembunyikan data" : "Lihat data"}
                  </button>
                ) : null}
              </p>
              {entry.payload !== undefined && isOpen ? (
                <pre className={styles.logPayload}>{JSON.stringify(entry.payload, null, 2)}</pre>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SamanthaStageCard({
  status,
  objective,
}: {
  readonly status: SimulationStatusDto;
  readonly objective: ObjectiveDto | null | undefined;
}): React.ReactElement {
  const samantha = status.result?.samantha;
  const pending = samantha === undefined;
  const [previewOpen, setPreviewOpen] = useState(false);
  const targeting = samantha?.audienceTargeting;

  return (
    <div className={styles.stageCard}>
      <div className={styles.stageHeader}>
        <span className={styles.stageName}>Step 2 · Samantha</span>
        <span className={badgeClass(pending ? "pending" : samantha.available ? "ok" : "warn")}>
          {pending ? "Menunggu" : samantha.available ? "Selesai" : "Tidak tersedia"}
        </span>
      </div>
      {pending ? <p className={styles.mutedText}>Menunggu analisa Samantha…</p> : null}
      {!pending && samantha.available ? (
        <>
          <p className={styles.mutedText}>{samantha.ringkasan}</p>
          <p className={styles.mutedText}>
            {samantha.temuan?.length ?? 0} temuan · {samantha.rekomendasi?.length ?? 0} rekomendasi
            · {samantha.elapsedMs}ms
          </p>
        </>
      ) : null}
      {!pending && !samantha.available ? (
        <p className={styles.mutedText}>{samantha.reason}</p>
      ) : null}

      {targeting !== undefined ? (
        <>
          <button
            type="button"
            onClick={() => setPreviewOpen((open) => !open)}
            className={styles.secondaryButton}
          >
            {previewOpen ? "Tutup" : "Lihat"} Campaign yang Akan Dibuat (Preview)
          </button>
          {previewOpen ? <CampaignPreview targeting={targeting} objective={objective} /> : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * "Campaign yang Akan Dibuat (Preview)" — display only. Nothing here is ever submitted to Meta:
 * real campaign creation lives on `/meta-ads/strategi` and constructs no targeting at all.
 *
 * Every value shown is either real or explicitly labelled as an unreviewed default:
 * - Geo/age come from the branch defaults, rendered together with their verbatim `geoNote` caveat.
 * - Interests are real Meta interests (Meta's own ids and audience-size bounds).
 * - Daily budget is the objective's real monthly `budgetAllocation` divided by 30.
 *
 * Deliberately ABSENT: buying type, special ad categories, placement lists, bid strategy, and
 * frequency caps. None of those exist anywhere real in this system, so they are omitted rather
 * than filled with plausible-looking invented numbers.
 */
function CampaignPreview({
  targeting,
  objective,
}: {
  readonly targeting: NonNullable<SimulationStatusDto["result"]>["samantha"]["audienceTargeting"];
  readonly objective: ObjectiveDto | null | undefined;
}): React.ReactElement | null {
  if (targeting === undefined) {
    return null;
  }
  const dailyBudget =
    objective !== null && objective !== undefined
      ? Math.round(objective.budgetAllocation / DAYS_PER_MONTH)
      : undefined;

  return (
    <div data-testid="campaign-preview" className={styles.previewBox}>
      <p className={styles.previewHeading}>Budget &amp; Jadwal</p>
      <p className={styles.mutedText}>
        {dailyBudget !== undefined
          ? `Budget harian ≈ Rp ${dailyBudget.toLocaleString("id-ID")} (dari budget objective bulan ini ÷ ${DAYS_PER_MONTH} hari)`
          : "Belum ada objective bulan ini — budget harian belum bisa dihitung."}
      </p>

      <p className={styles.previewHeading}>Audience — Lokasi &amp; Usia</p>
      <p className={styles.mutedText}>
        Cabang {targeting.branch} · {targeting.geo.join(", ")}
        {targeting.radiusKm > 0 ? ` · radius ${targeting.radiusKm} km` : ""} · usia{" "}
        {targeting.ageMin}–{targeting.ageMax}
      </p>
      <p className={styles.previewWarning}>{targeting.geoNote}</p>

      <p className={styles.previewHeading}>
        Audience — Interest Meta ({targeting.interests.length} dipilih dari{" "}
        {targeting.candidateCount} kandidat)
      </p>
      {targeting.interests.length === 0 ? (
        <p className={styles.mutedText}>
          {targeting.interestsUnavailableReason === "NO_CANDIDATES"
            ? "Belum ada interest tersimpan — jalankan sync interest Meta dulu (POST /api/v1/meta-interests/sync)."
            : `Interest belum bisa dipilih: ${targeting.interestsUnavailableReason ?? "unknown"}.`}
        </p>
      ) : (
        <div className={styles.list}>
          {targeting.interests.map((interest) => (
            <div key={interest.id} className={styles.row}>
              <span className={styles.rowText}>
                {interest.name}
                {interest.topic !== undefined ? ` · ${interest.topic}` : ""}
              </span>
              <span className={styles.mutedText}>
                {interest.audienceSizeLower.toLocaleString("id-ID")}–
                {interest.audienceSizeUpper.toLocaleString("id-ID")} orang (data Meta)
              </span>
            </div>
          ))}
        </div>
      )}
      {targeting.reasoning !== undefined ? (
        <p className={styles.mutedText}>Alasan Samantha: {targeting.reasoning}</p>
      ) : null}

      <p className={styles.previewHeading}>Campaign / AdSet — Meta Marketing API</p>
      <p className={styles.mutedText}>
        Struktur field di bawah ini sama persis dengan yang dikirim{" "}
        <code>@aos/meta-ads-connector</code>&apos;s <code>CreateCampaign</code> use case nyata (satu
        campaign OUTCOME_LEADS + satu ad set CTWA WhatsApp, keduanya mulai PAUSED) — bukan field
        yang dikarang untuk preview ini.
      </p>
      <div className={styles.list}>
        <div className={styles.row}>
          <span className={styles.rowText}>Campaign objective</span>
          <span className={styles.mutedText}>OUTCOME_LEADS</span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowText}>Campaign status awal</span>
          <span className={styles.mutedText}>PAUSED (approve manual sebelum aktif)</span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowText}>AdSet destination</span>
          <span className={styles.mutedText}>WHATSAPP (CTWA)</span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowText}>AdSet optimization / billing</span>
          <span className={styles.mutedText}>LEAD_GENERATION / IMPRESSIONS</span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowText}>AdSet daily budget</span>
          <span className={styles.mutedText}>
            {dailyBudget !== undefined
              ? `Rp ${dailyBudget.toLocaleString("id-ID")}/hari`
              : "Belum ada objective — pakai default Rp 100.000/hari"}
          </span>
        </div>
      </div>
      <p className={styles.mutedText}>
        Tidak ada &quot;createAd&quot; nyata di connector ini hari ini — hanya campaign + ad set
        yang dibuat; unit iklan (creative) dipasang manual di Meta Ads Manager setelah approve.
      </p>

      <div className={styles.formRow} style={{ flexDirection: "row", gap: 8 }}>
        <button
          type="button"
          onClick={() => void copyJson(buildCampaignExportJson(targeting, dailyBudget))}
          className={styles.secondaryButton}
        >
          Copy JSON Config
        </button>
        <button
          type="button"
          onClick={() => void copyJson(buildCampaignExportJson(targeting, dailyBudget))}
          className={styles.secondaryButton}
        >
          Export untuk Meta API
        </button>
      </div>

      <p className={styles.mutedText}>
        Preview saja — simulasi ini tidak membuat campaign Meta apa pun.
      </p>
    </div>
  );
}

function copyJson(value: unknown): void {
  void navigator.clipboard.writeText(JSON.stringify(value, null, 2));
}

/**
 * Builds the exact request-body shape `IMetaAdsClient.createCampaign`/`createAdSet` accept
 * (`CreateCampaignParams`/`CreateAdSetParams`, `packages/meta-ads-connector/src/contracts/
 * IMetaAdsClient.ts`) plus the targeting block for reference — every field name and literal here
 * matches what `CreateCampaign.execute` really sends to Meta (see that use case's source), never an
 * invented field (no `bid_strategy`, no `placements`, nothing this connector doesn't really have).
 */
function buildCampaignExportJson(
  targeting: NonNullable<SimulationStatusDto["result"]>["samantha"]["audienceTargeting"],
  dailyBudget: number | undefined,
): Record<string, unknown> {
  const dailyBudgetIDR = dailyBudget ?? 100_000;
  return {
    campaign: {
      name: `Simulasi — ${targeting?.branch ?? ""}`,
      objective: "OUTCOME_LEADS",
      specialAdCategories: [],
      status: "PAUSED",
    },
    adSet: {
      name: `Simulasi — ${targeting?.branch ?? ""}-adset`,
      destinationType: "WHATSAPP",
      optimizationGoal: "LEAD_GENERATION",
      billingEvent: "IMPRESSIONS",
      dailyBudgetCents: Math.round(dailyBudgetIDR * 100),
      status: "PAUSED",
    },
    targetingPreview: targeting,
    note:
      "targetingPreview bukan field Meta API nyata — CreateCampaign/CreateAdSet tidak mengirim " +
      "targeting apa pun hari ini; disertakan di sini hanya untuk referensi manual.",
  };
}

function KaiStageCard({ status }: { readonly status: SimulationStatusDto }): React.ReactElement {
  const kai = status.result?.kai;
  const pending = kai === undefined;
  const [promptOpen, setPromptOpen] = useState(false);
  return (
    <div className={styles.stageCard}>
      <div className={styles.stageHeader}>
        <span className={styles.stageName}>Step 3 · Kai</span>
        <span className={badgeClass(pending ? "pending" : kai.available ? "ok" : "warn")}>
          {pending ? "Menunggu" : kai.available ? "Brief siap" : "Tidak tersedia"}
        </span>
      </div>
      {pending ? <p className={styles.mutedText}>Menunggu brief dari Samantha…</p> : null}
      {!pending && kai.available && kai.brief !== undefined ? (
        <>
          <p className={styles.rowText}>{kai.brief.primaryMessage}</p>
          <p className={styles.mutedText}>
            {kai.brief.angle} · {kai.brief.formats.join(", ")}
          </p>
        </>
      ) : null}
      {!pending ? <p className={styles.mutedText}>{kai.note}</p> : null}

      {!pending && kai.promptDetail !== undefined ? (
        <>
          <button
            type="button"
            onClick={() => setPromptOpen((open) => !open)}
            className={styles.secondaryButton}
          >
            {promptOpen ? "Tutup" : "Lihat"} Prompt Kai → Kie AI
          </button>
          {promptOpen ? <KaiPromptPreview detail={kai.promptDetail} /> : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * "Prompt Kai → Kie AI" (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 3, section C) — display only,
 * same hard scope boundary as `CampaignPreview`: nothing here calls Kie AI. Every value is what
 * `aaos-api`'s real `FormatDecisionService`/`PromptBuildingService`/`CopyBuilder` pipeline would
 * actually produce for this exact brief (see `simulation.service.ts`'s `buildKaiPromptDetail` doc)
 * — never a hand-written "representative" example.
 *
 * No "Regenerate" button: the prompt is a deterministic function of the brief already shown above,
 * so there is nothing a client-side "regenerate" could honestly recompute — a genuinely different
 * prompt requires a new dry-run (Step 1's "Mulai Simulasi Dry-Run"), not a per-panel action.
 */
function KaiPromptPreview({
  detail,
}: {
  readonly detail: NonNullable<SimulationKaiStageDto["promptDetail"]>;
}): React.ReactElement {
  function copyAllPrompts(): void {
    const parts: string[] = [];
    if (detail.videoPrompt !== undefined) {
      parts.push(`VIDEO PROMPT:\n${detail.videoPrompt}`);
    }
    detail.imagePrompts.forEach((prompt, index) => {
      parts.push(`IMAGE PROMPT ${index + 1}:\n${prompt}`);
    });
    void navigator.clipboard.writeText(parts.join("\n\n"));
  }

  return (
    <div data-testid="kai-prompt-preview" className={styles.previewBox}>
      <p className={styles.previewHeading}>Format &amp; Model</p>
      <p className={styles.mutedText}>
        {detail.format} · Gambar: {detail.imageModel} ({detail.imageAspectRatio},{" "}
        {detail.imageCount} varian)
        {detail.videoModel !== undefined
          ? ` · Video: ${detail.videoModel} (${detail.videoDurationSeconds}s, ${detail.videoAspectRatio ?? ""})`
          : ""}
      </p>

      <p className={styles.previewHeading}>Foto Sumber ({detail.sourcePhotoUrls.length})</p>
      {detail.sourcePhotoUrls.length === 0 ? (
        <p className={styles.mutedText}>
          Tidak ada foto sumber ditemukan di asset library untuk unit ini — Kai generate dari
          deskripsi teks saja.
        </p>
      ) : (
        <div className={styles.list}>
          {detail.sourcePhotoUrls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element -- a small, real, arbitrary-host asset-library URL; not worth Next/Image's remote-pattern config for a preview thumbnail.
            <img
              key={url}
              src={url}
              alt="Foto sumber"
              style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }}
            />
          ))}
        </div>
      )}

      {detail.videoPrompt !== undefined ? (
        <>
          <p className={styles.previewHeading}>EN Video Prompt</p>
          <pre className={styles.logPayload}>{detail.videoPrompt}</pre>
        </>
      ) : null}

      <p className={styles.previewHeading}>EN Image Prompts ({detail.imagePrompts.length})</p>
      {detail.imagePrompts.map((prompt, index) => (
        <pre key={index} className={styles.logPayload}>
          {prompt}
        </pre>
      ))}

      <button type="button" onClick={copyAllPrompts} className={styles.secondaryButton}>
        Copy semua prompts
      </button>

      <p className={styles.previewHeading}>Copy Variants (ID)</p>
      {detail.copyVariants.length === 0 ? (
        <p className={styles.mutedText}>
          {detail.copyVariantsUnavailableReason ?? "Belum ada copy variant untuk brief ini."}
        </p>
      ) : (
        <div className={styles.list}>
          {detail.copyVariants.map((variant) => (
            <div key={variant.id} className={styles.row}>
              <span className={styles.rowText}>
                {variant.variantLabel} — {variant.headline}
              </span>
              <span className={styles.mutedText}>
                {variant.primaryText} · CTA: {variant.callToAction}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className={styles.mutedText}>
        Preview saja — belum ada generate Kie AI nyata pada simulasi ini.
      </p>
    </div>
  );
}

function ClaraStageCard({ status }: { readonly status: SimulationStatusDto }): React.ReactElement {
  const clara = status.result?.clara;
  const pending = clara === undefined;
  return (
    <div className={styles.stageCard}>
      <div className={styles.stageHeader}>
        <span className={styles.stageName}>Step 4-5 · Clara + Judge</span>
        <span
          className={badgeClass(
            pending
              ? "pending"
              : !clara.available
                ? "warn"
                : clara.runs.some((r) => !r.ok)
                  ? "warn"
                  : "ok",
          )}
        >
          {pending
            ? "Menunggu"
            : clara.available
              ? `${clara.runs.length} persona`
              : "Tidak tersedia"}
        </span>
      </div>
      {pending ? <p className={styles.mutedText}>Menunggu simulasi Clara…</p> : null}
      {!pending && !clara.available ? <p className={styles.mutedText}>{clara.reason}</p> : null}
      {!pending && clara.available ? (
        <div className={styles.list}>
          {clara.runs.map((run) => (
            <div key={run.personaId} className={styles.row}>
              <span className={styles.rowText}>{run.personaId}</span>
              <span className={styles.mutedText}>
                {run.ok ? `${run.overallScore} (${run.grade})` : run.error}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
