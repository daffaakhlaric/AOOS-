"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { AbTestingClient } from "@/components/meta-ads/AbTestingClient";
import { DateRangeSelector } from "@/components/meta-ads/DateRangeSelector";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { TopBar } from "@/components/layout/TopBar";
import { isCacheFresh, readCampaignsCache } from "@/lib/campaignsCache";
import { formatDateTimeIdWib } from "@/lib/formatters";
import { useCampaignsSnapshot } from "@/lib/useCampaignsSnapshot";
import type { SettingsDto } from "@/types/tenant.types";

import { accountBenchmarkCpl, accountBenchmarkCtr } from "./campaignInsightMath";
import { AndromedaHealthCard } from "./AndromedaHealthCard";
import { CampaignHealthCard } from "./CampaignHealthCard";
import { OpportunitiesCard } from "./OpportunitiesCard";
import { BudgetTracker } from "./BudgetTracker";
import { CampaignInsightPanel } from "./CampaignInsightPanel";
import { ObjectiveStripCard } from "./ObjectiveStripCard";
import { SamanthaInsightBar } from "./SamanthaInsightBar";
import { UnifiedCampaignTable } from "./UnifiedCampaignTable";
import { VerdictCards } from "./VerdictCards";
import styles from "./CampaignsHubClient.module.css";

export interface CampaignsHubClientProps {
  /** `?view=ab-testing` real escape hatch — see this component's own doc for why `AbTestingClient` stays reachable rather than silently dropped. Any other value (or `undefined`) renders the real unified page. */
  readonly initialView?: string;
}

/**
 * AAOS-CAMPAIGNS-UNIFIED-PAGE — the `/campaigns` real single tab-less page (REBUILD, replacing
 * `02c475f`'s tabbed structure: Metrics/Aktif/Verdict/A-B Testing/Anggaran/Objective tabs → one
 * vertical-scroll page per the user's own spec).
 *
 * Layout (spec's own numbered structure):
 *  1. Topbar — title + real DEV/LIVE mode badge (SAME `GET /api/settings` fetch every prior phase
 *     already established) + "Analisa Samantha" button (selects the top-priority actionable
 *     campaign and opens its real LLM-backed `CampaignInsightPanel`).
 *  2. `SamanthaInsightBar` — a real, zero-cost DETERMINISTIC summary (not an LLM call for every
 *     campaign on every page load — see that component's own doc for why).
 *  3. Filter bar — search + period (`DateRangeSelector`, reusing the exact real `datePreset` param
 *     `GET /api/v1/campaigns` accepts) + campaign count + "Tarik Data Baru" (the real manual-pull
 *     house style `MetaAdsClient.tsx` already established — this page is now the only real entry
 *     point into `useCampaignsSnapshot()`'s `pull()`, since the old "Aktif" tab is retired).
 *
 * REAL BUG FIX (AAOS-CAMPAIGNS-AUTO-PULL): being this page's ONLY real entry point into `pull()`
 * meant a first-time visit — or a visit after the shared 60-minute `localStorage` TTL lapsed —
 * rendered whatever stale/absent snapshot was cached, with every Verdict/spend/CPL card frozen at
 * "Rp 0"/"—" until the user knew to click "Tarik Data Baru" themselves (reported live: verdict
 * cards looked permanently static). This page now auto-pulls ONCE on mount, but ONLY when there is
 * no cached snapshot or it has gone stale (`isCacheFresh`) — a fresh cache still renders instantly
 * with zero network call, so this does not turn into an auto-refresh-on-every-visit and does not
 * change the deliberate manual-pull house style the other `/meta-ads` pages still rely on (this
 * fix is scoped to this component only, not to the shared `useCampaignsSnapshot()` hook).
 *  4. `UnifiedCampaignTable` — ONE real table (toggle/budget/spend/CPL pill/frequency/verdict).
 *  5. `CampaignInsightPanel` — click-to-expand, appears below the table for the selected campaign.
 *  6. Bottom strip — `VerdictCards` | `BudgetTracker` | `ObjectiveStripCard`, 3 real cards side by
 *     side.
 *
 * REAL VERDICT SYSTEM INVESTIGATION (documented once here, referenced by `VerdictCards.tsx`'s own
 * doc): this app has TWO distinct real "verdict"/approval concepts — `PendingActionsService`
 * (human-approval gate for exactly `CREATE_PROPERTY_CAMPAIGN`, a different action entirely) and
 * the direct `POST /api/verdicts` → `executeVerdict` flow `CampaignTree`'s "⚡ Execute" button
 * already uses for SCALE/PAUSE/FIX/REFRESH on an EXISTING campaign/ad-set/ad. This page's
 * `handleApplyVerdict`/`handlePauseCampaign` both call the SAME real second mechanism — never a
 * fabricated third path.
 *
 * REAL BUDGET FIELD INVESTIGATION: no per-campaign budget-cap field exists anywhere in this
 * codebase (re-confirmed for this dispatch — see `BudgetTracker.tsx`'s own doc) — the unified
 * table's "Budget" column and the bottom-strip "Anggaran" card both honestly degrade rather than
 * fabricate a cap.
 *
 * A/B TESTING TAB DECISION: the pre-rebuild "A/B Testing" tab (`AbTestingClient` — real RUNNING/
 * COMPLETE/DRAFT formal test lifecycle management) is genuinely DISTINCT from Creative's own
 * "A/B Results" tab (`WinningCombos`/`HeatmapGrid` — ranked creative-performance analysis derived
 * from the heatmap, no test lifecycle at all). The new unified page's bottom strip has no A/B card
 * per the user's own spec, so dropping the TAB is correct — but silently deleting the real
 * `AbTestingClient` feature entirely would lose real functionality with no trace. It stays
 * reachable via `?view=ab-testing` (linked from `CampaignInsightPanel`'s own footer) — a real,
 * honest navigation escape hatch, same precedent `WinningCombos.tsx`'s "Apply ke campaign aktif"
 * button already established for a comparable real gap.
 */
export function CampaignsHubClient({ initialView }: CampaignsHubClientProps): React.ReactElement {
  const [mode, setMode] = useState<"DEV" | "LIVE" | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | undefined>(undefined);
  const [targetCplIDR, setTargetCplIDR] = useState<number | null | undefined>(undefined);
  const [datePreset, setDatePreset] = useState("last_30d");
  // Campaign->Listing Mapping — real, best-effort lookup of the selected campaign's real
  // `listings.id`, so `AndromedaHealthCard`/`CampaignInsightPanel`'s `MetaSettingsPanel` can
  // enable their real "Brief Kai" actions instead of always rendering honestly disabled.
  // `undefined` while loading or when the real link genuinely doesn't exist yet.
  const [selectedListingId, setSelectedListingId] = useState<string | undefined>(undefined);

  const { data, fetchedAt, loading, error, pull } = useCampaignsSnapshot();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) => (res.ok ? (res.json() as Promise<SettingsDto>) : null))
      .then((body) => {
        if (!cancelled && body !== null) {
          setMode(body.tenant.mode);
        }
      })
      .catch(() => {
        // Best-effort only, same discipline as every other page's identical fetch.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Real bug fix: this page is the primary landing view for Verdict/spend/CPL analysis, but
  // `useCampaignsSnapshot()` never auto-fetches (a deliberate manual-pull-only house style shared
  // with `/meta-ads`'s pages — see that hook's own doc). A first-time visit, or a visit after the
  // 60-minute localStorage TTL has lapsed, therefore rendered whatever was last pulled (or nothing
  // at all — Rp 0 spend, "—" CPL on every card) until the user knew to click "Tarik Data Baru".
  // Auto-pull ONCE on mount, but only when there's no cached snapshot or it's gone stale — a fresh
  // cache still renders instantly with zero network call, matching every other page's behavior.
  useEffect(() => {
    // The `?view=ab-testing` escape hatch renders none of the unified page's campaign/Verdict UI
    // (see the early `return` below) — no reason to fire a real Meta pull nothing on that view
    // will read.
    if (initialView === "ab-testing") {
      return;
    }
    const cached = readCampaignsCache();
    if (cached === undefined || !isCacheFresh(cached)) {
      void pull(datePreset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialView]);

  const campaigns = useMemo(() => data?.campaigns ?? [], [data]);
  const filteredCampaigns = useMemo(
    () =>
      search.trim().length === 0
        ? campaigns
        : campaigns.filter((campaign) =>
            campaign.name.toLowerCase().includes(search.trim().toLowerCase()),
          ),
    [campaigns, search],
  );

  // Real CPL benchmark: prefer the tenant's own filled-in `property_objectives.targetCpl`
  // business-context number (reported up by `ObjectiveStripCard`); fall back to a real
  // account-wide average CPL computed from the current snapshot; `null` when neither exists.
  const accountFallbackBenchmark = useMemo(() => accountBenchmarkCpl(campaigns), [campaigns]);
  const benchmarkCplIDR =
    targetCplIDR !== undefined && targetCplIDR !== null ? targetCplIDR : accountFallbackBenchmark;
  // SAMANTHA META ADS SETTINGS + CREATIVE COPY — real account-wide average CTR, no equivalent
  // tenant-filled-in business-context field exists for CTR (unlike `targetCplIDR` above), so this
  // is always the real account-wide computed value, `null` only when no campaign has real
  // impressions data yet.
  const benchmarkCtr = useMemo(() => accountBenchmarkCtr(campaigns), [campaigns]);

  const selectedCampaign = filteredCampaigns.find((campaign) => campaign.id === selectedCampaignId);

  // Campaign->Listing Mapping — real, best-effort fetch of the selected campaign's real
  // `listings.id` link (`GET /api/campaigns/:campaignId/listing-id`, `meta_campaigns.listing_id`).
  // Keyed by the real, stable `metaId` (never `id` — same convention `andromeda-health`/`history`
  // already establish). A failure or a genuinely-absent link just leaves `selectedListingId`
  // `undefined` — the real "Brief Kai" buttons below degrade to their existing honest-disabled
  // state, never a fabricated id.
  useEffect(() => {
    let cancelled = false;
    setSelectedListingId(undefined);
    if (selectedCampaign === undefined) {
      return;
    }
    fetch(`/api/campaigns/${encodeURIComponent(selectedCampaign.metaId)}/listing-id`)
      .then((res) => (res.ok ? (res.json() as Promise<{ listingId?: string | null }>) : undefined))
      .then((body) => {
        if (!cancelled && body?.listingId !== null && body?.listingId !== undefined) {
          setSelectedListingId(body.listingId);
        }
      })
      .catch(() => {
        // Best-effort only — the real "Brief Kai" buttons just stay honestly disabled.
      });
    return () => {
      cancelled = true;
    };
    // Keyed on the real, stable `metaId` primitive, never the `selectedCampaign` object itself
    // (re-derived fresh on every render via `.find(...)`, which would re-fire this effect on
    // every render instead of only on a genuine selection change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaign?.metaId]);

  // Real bug fix (live-confirmed via a 404 in aaos-api's own logs on the sibling Andromeda Health
  // lookup — the exact same root cause applies here): `UnifiedCampaignTable`/`VerdictCards` call
  // `onPause`/`onApply` with `campaign.id`, a LOCAL id re-generated randomly on every live pull —
  // never a real, stable Meta object id. `POST /api/verdicts` sends `targetId` straight through to
  // Meta's real Graph API (`VerdictExecutionService`: `POST /{ad-id|adset-id|campaign-id}`), so a
  // random UUID there was silently failing against Meta in LIVE mode every single time — the real
  // root cause of "verdict masih static" (Terapkan/pause never actually applying). Resolves the
  // real, stable `metaId` from the already-loaded `campaigns` list before sending.
  function resolveMetaId(campaignId: string): string {
    return campaigns.find((campaign) => campaign.id === campaignId)?.metaId ?? campaignId;
  }

  function handlePauseCampaign(campaignId: string): void {
    void fetch("/api/verdicts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        verdict: "PAUSE",
        targetId: resolveMetaId(campaignId),
        targetType: "campaign",
      }),
    })
      .then(() => pull(datePreset))
      .catch(() => undefined);
  }

  function handleApplyVerdict(campaignId: string, verdict: string): void {
    void fetch("/api/verdicts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        verdict,
        targetId: resolveMetaId(campaignId),
        targetType: "campaign",
      }),
    })
      .then(() => pull(datePreset))
      .catch(() => undefined);
  }

  function handleAnalisaSamantha(): void {
    if (filteredCampaigns.length === 0) return;
    const first = filteredCampaigns[0];
    if (first !== undefined) {
      setSelectedCampaignId(first.id);
    }
  }

  if (initialView === "ab-testing") {
    return (
      <main>
        <TopBar title="Campaign" accentColor="var(--v2-menu-campaigns)" />
        <div className={styles.tabBody}>
          <Link href="/campaigns" className={styles.backLink}>
            ← Kembali ke Campaign
          </Link>
          <h2 className={styles.sectionTitle}>A/B Testing</h2>
          <AbTestingClient />
        </div>
      </main>
    );
  }

  return (
    <main>
      <TopBar title="Campaign" accentColor="var(--v2-menu-campaigns)" />
      <div className={styles.headerExtra}>
        <div className={styles.headerLeft}>
          {mode !== undefined ? (
            <span
              data-testid="mode-badge"
              className={styles.modeBadge}
              style={
                mode === "LIVE"
                  ? { background: "var(--v2-live-mode-bg)", color: "var(--v2-live-mode-color)" }
                  : { background: "var(--v2-dev-bg)", color: "var(--v2-dev-color)" }
              }
            >
              {mode}
            </span>
          ) : null}
        </div>
        <Link
          href="/growth-objectives"
          data-testid="growth-objectives-link"
          className={styles.runLoopButton}
        >
          🎯 Growth Objectives
        </Link>
        <button
          type="button"
          data-testid="analisa-samantha-button"
          onClick={handleAnalisaSamantha}
          className={styles.runLoopButton}
        >
          🧠 Analisa Samantha
        </button>
      </div>

      <div className={styles.tabBody}>
        <SamanthaInsightBar campaigns={filteredCampaigns} />

        <div className={styles.filterBar}>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama/ID campaign..."
            aria-label="Cari campaign"
            className={styles.searchInput}
          />
          <DateRangeSelector
            value={datePreset}
            onChange={(preset) => {
              setDatePreset(preset);
              void pull(preset);
            }}
          />
          <span className={styles.campaignCount} data-testid="campaign-count">
            {filteredCampaigns.length} campaign
          </span>
          <span className={styles.spacer} />
          <button
            type="button"
            onClick={() => void pull(datePreset)}
            disabled={loading}
            className={styles.pullButton}
          >
            ↻ Tarik Data Baru
          </button>
        </div>
        {fetchedAt !== undefined ? (
          <p data-testid="last-updated" className={styles.lastUpdated}>
            🕒 Diambil {formatDateTimeIdWib(new Date(fetchedAt).toISOString())}
          </p>
        ) : null}

        {data === undefined && loading ? <LoadingSpinner /> : null}
        {data === undefined && !loading && error !== undefined ? (
          <ErrorCard message={error} />
        ) : null}
        {data === undefined && !loading && error === undefined ? (
          <EmptyState
            title="Belum ada data"
            description='Klik "Tarik Data Baru" untuk memuat data campaign dari Meta.'
          />
        ) : null}

        {data !== undefined ? (
          <>
            <UnifiedCampaignTable
              campaigns={filteredCampaigns}
              benchmarkCplIDR={benchmarkCplIDR}
              selectedCampaignId={selectedCampaignId}
              onSelect={(campaignId) =>
                setSelectedCampaignId((current) =>
                  current === campaignId ? undefined : campaignId,
                )
              }
              onPause={handlePauseCampaign}
            />

            {selectedCampaign !== undefined ? (
              <CampaignInsightPanel
                campaign={selectedCampaign}
                benchmarkCplIDR={benchmarkCplIDR}
                benchmarkCtr={benchmarkCtr}
                listingId={selectedListingId}
                onClose={() => setSelectedCampaignId(undefined)}
              />
            ) : null}

            {/* Samantha Andromeda-Aware Campaign System, Sprint 2 — "after the campaign table,
                before Verdict cards" (the pasted spec's own placement instruction), rendered only
                for the currently-selected campaign since Sprint 1's diversity scoring is real
                per-campaign, not per-tenant (see `AndromedaHealthCard`'s own doc). `listingId` is
                the real Campaign->Listing Mapping lookup above (053_meta_campaigns_listing_id.sql)
                — `undefined` (never fabricated) for the honest common case of a campaign with no
                real link yet, in which case the card itself degrades "Brief Kai sekarang" to its
                existing disabled, explained state. */}
            {selectedCampaign !== undefined ? (
              <AndromedaHealthCard
                // Real bug fix (live-confirmed 404): `getAndromedaHealth` does its OWN fresh live
                // pull and looks this campaign back up by its real, stable `metaId` — `id` is a
                // local id re-generated randomly on every pull, so it can never match across two
                // separate requests. See `CampaignSummaryDto.metaId`'s own doc.
                campaignId={selectedCampaign.metaId}
                campaignName={selectedCampaign.name}
                listingId={selectedListingId}
              />
            ) : null}

            {/* EYVRA — Samantha V2 Phase 14 — surfaces Phase 3/4's real, deterministic
                CampaignHealth/CampaignDiagnosis/SamanthaDecision VISUALLY for the first time
                (previously computed but only silently fed into the LLM prompt via Phase 12's
                CampaignInsightPanel wiring, GET /api/campaign-health/:campaignId — reused as-is,
                no new backend route). Placed before OpportunitiesCard: health/diagnosis logically
                precedes "what opportunities exist" in the narrative, and OpportunitiesCard's own
                SCALING_OPPORTUNITY detector is itself derived from this same data. Rendered only
                for the currently-selected campaign for the same reason AndromedaHealthCard/
                OpportunitiesCard are — this assessment is real per-campaign data, not tenant-wide. */}
            {selectedCampaign !== undefined ? (
              <CampaignHealthCard
                campaignId={selectedCampaign.metaId}
                campaignName={selectedCampaign.name}
                listingId={selectedListingId}
              />
            ) : null}

            {/* EYVRA — Samantha V2 + Kai V2 Phase 13 — real per-campaign opportunity findings from
                Phase 9's Opportunity Engine: scaling opportunities from Campaign Health's real
                SCALE decisions, creative-winner opportunities from Creative Memory's rank-1
                angles. Rendered only for the currently-selected campaign for the same reason
                `AndromedaHealthCard` is — the Opportunity Engine's detectors are real per-campaign
                data, not tenant-wide. */}
            {selectedCampaign !== undefined ? (
              <OpportunitiesCard
                campaignId={selectedCampaign.metaId}
                campaignName={selectedCampaign.name}
              />
            ) : null}

            <div className={styles.bottomStrip} data-testid="bottom-strip">
              <VerdictCards
                campaigns={filteredCampaigns}
                onApply={handleApplyVerdict}
                loading={loading}
              />
              <BudgetTracker campaigns={filteredCampaigns} />
              <ObjectiveStripCard
                onTargetCplResolved={setTargetCplIDR}
                campaigns={filteredCampaigns}
              />
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}

export default CampaignsHubClient;
