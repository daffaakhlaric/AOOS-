"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CampaignHealthCard } from "@/components/campaigns/CampaignHealthCard";
import { CreativePackageCard } from "@/components/creative/CreativePackageCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import { isCacheFresh, readCampaignsCache } from "@/lib/campaignsCache";
import { useCampaignsSnapshot } from "@/lib/useCampaignsSnapshot";
import type { CreativePackageDto, CreativePackageStatusDto } from "@/types/dashboard.types";

import styles from "./KaiStudioClient.module.css";

const POLL_INTERVAL_MS = 5000;

/**
 * Real, honest 4-stage indicator built ONLY from `CreativePackageStatusDto`'s real 6 values
 * (`DRAFT`/`GENERATING`/`PENDING`/`APPROVED`/`REJECTED`/`FAILED` — `dashboard.types.ts`'s own
 * `AAOS-CREATIVE-REVIEW` doc). The mockup's 6-step "Brief→Concept→Generate→QA→Shortlist→Test"
 * pipeline stepper is NOT built here: this codebase has no live per-job step-tracking state
 * machine anywhere (Phase 27/49's Generation Job audit found only the 4
 * PENDING/GENERATING/READY/FAILED in-memory states, and `creative_packages` itself has no
 * "Concept"/"QA"/"Shortlist"/"Test" columns) — fabricating those extra steps would be exactly the
 * kind of invented UI state this whole initiative's discipline forbids.
 *
 * Instead, the 4 REAL on-path statuses are mapped 1:1 onto 4 honest stage labels a manager will
 * recognize as the same real states already shown elsewhere in this app (`STATUS_TONE` in
 * `CreativePackageCard.tsx`, the `CreativeClient.tsx` KPI strip):
 *   DRAFT (brief saved, not sent) -> "Brief"
 *   GENERATING (Kie AI running)   -> "Generate"
 *   PENDING (awaiting review)     -> "Review"
 *   APPROVED (reviewed, kept)     -> "Approved"
 * `REJECTED`/`FAILED` are real terminal OFF-path outcomes, never forced onto one of the 4
 * positions above (a rejected package didn't "complete" the Review stage, it left the pipeline) —
 * shown as their own distinct badge instead, same honest-degrade judgment call
 * `ProcessingTab`/`CreativePackageCard` already make for these two statuses elsewhere.
 */
type OnPathStatus = "DRAFT" | "GENERATING" | "PENDING" | "APPROVED";

const STAGE_STATUSES: readonly OnPathStatus[] = ["DRAFT", "GENERATING", "PENDING", "APPROVED"];
const STAGE_LABELS: Record<OnPathStatus, string> = {
  DRAFT: "Brief",
  GENERATING: "Generate",
  PENDING: "Review",
  APPROVED: "Approved",
};

function PackageStageStepper({
  status,
}: {
  readonly status: CreativePackageStatusDto;
}): React.ReactElement {
  const offPath = status === "REJECTED" || status === "FAILED";
  const currentIndex = STAGE_STATUSES.findIndex((stage) => stage === status);

  return (
    <div data-testid="kai-studio-stepper" className={styles.stepper}>
      {STAGE_STATUSES.map((stage, index) => (
        <div
          key={stage}
          data-testid="kai-studio-stepper-step"
          className={[
            styles.stepperStep,
            !offPath && index === currentIndex ? styles.stepperStepCurrent : "",
            !offPath && index < currentIndex ? styles.stepperStepDone : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {STAGE_LABELS[stage]}
        </div>
      ))}
      {offPath ? (
        <div data-testid="kai-studio-stepper-offpath" className={styles.stepperOffPath}>
          {status === "REJECTED" ? "Ditolak" : "Gagal"}
        </div>
      ) : null}
    </div>
  );
}

const GRID_STATUS_TONE: Record<CreativePackageStatusDto, StatusTone> = {
  DRAFT: "neutral",
  GENERATING: "warning",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  FAILED: "danger",
};

interface ConceptGridCardProps {
  readonly pkg: CreativePackageDto;
  readonly selected: boolean;
  readonly onSelect: () => void;
}

/**
 * One "Creative Concepts grid" card — deliberately lightweight (title/angle/real status/real
 * thumbnail), NOT a re-render of the full `CreativePackageCard` (that lives in the Inspector
 * column instead, once a card here is selected, per this phase's "reuse the real detail view
 * rather than build a second one" instruction). No fabricated "concept family" label: Phase 34's
 * angle-\>ConceptFamily mapper lives server-side only (`packages/creative-agent`) with no client
 * endpoint exposing it, so this card shows the real `pkg.angle` string as-is instead of inventing
 * a family grouping the frontend cannot honestly compute.
 */
function ConceptGridCard({ pkg, selected, onSelect }: ConceptGridCardProps): React.ReactElement {
  const thumbnail = pkg.imageUrls[0];
  return (
    <button
      type="button"
      data-testid="kai-studio-concept-card"
      onClick={onSelect}
      className={`${styles.conceptCard} ${selected ? styles.conceptCardSelected : ""}`}
    >
      {thumbnail !== undefined ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbnail} alt={pkg.title} className={styles.conceptThumb} loading="lazy" />
      ) : (
        <div className={styles.conceptThumbEmpty} aria-hidden="true">
          {pkg.videoUrl !== undefined ? "🎬" : "🖼"}
        </div>
      )}
      <div className={styles.conceptBody}>
        <p className={styles.conceptTitle}>{pkg.title}</p>
        <p className={styles.conceptAngle}>Angle: {pkg.angle}</p>
        <StatusBadge label={pkg.status} tone={GRID_STATUS_TONE[pkg.status]} />
      </div>
    </button>
  );
}

/**
 * `KaiStudioClient` (EYVRA SAMANTHA V2 + KAI V2 Phase 52 — PROMPT 85/86/87/88/89) — the real,
 * dedicated Kai Studio page the Sidebar's "Kai Studio" item previously pointed past (Phase 50 left
 * it aimed at `/creative`'s existing 6-tab hub as an honest placeholder). This page does NOT
 * duplicate `/creative`'s review queue — it is a new, campaign-scoped WORKSPACE view built on top
 * of the exact same real endpoints/components `CreativeHubClient`'s tabs already use:
 *
 *  - LEFT ("Samantha Brief"): the real, already-shipped `CampaignHealthCard` (Phase 14/18/19/23) —
 *    same real root-cause/decision/confidence diagnosis and the same real "Brief Kai Sekarang"
 *    button (`POST /api/creative-packages/diverse-set`) that already exists on `/campaigns`. Reused
 *    as-is rather than a second brief-summary component; the campaign selector above it reuses
 *    `useCampaignsSnapshot()`/`readCampaignsCache` and the SAME `GET /api/campaigns/:metaId/
 *    listing-id` lookup `CampaignsHubClient.tsx` already established for exactly this
 *    campaign->listing resolution.
 *  - MIDDLE ("Creative Concepts grid"): `GET /api/creative?limit=200` (the SAME real proxy route
 *    `CreativeClient.tsx` uses), filtered client-side to the selected campaign's real
 *    `listingId` (that route has no server-side `listingId` filter param — `CreativeClient.tsx`
 *    itself only ever filters by `status` client-side, so filtering by `listingId` the same way is
 *    the honest, precedented approach rather than inventing a new backend query param this phase
 *    was told not to add). Polls every 5s ONLY while a real package is `GENERATING`, same guard
 *    `CreativeClient.tsx` already uses (never a trigger for new work).
 *  - RIGHT ("Inspector"): the real, full `CreativePackageCard` (media, copy variants, Approve/
 *    Reject wired to the real `/api/creative/:id/approve`|`reject` routes) for whichever grid card
 *    is selected — the exact same detail view `CreativeClient.tsx`'s own review queue renders, not
 *    a second detail fetch/component.
 *  - STEPPER: see `PackageStageStepper`'s own doc — a real, honest 4-stage indicator built only
 *    from the 6 real `CreativePackageStatusDto` values, never a fabricated 6-step pipeline.
 */
export function KaiStudioClient(): React.ReactElement {
  const { data: campaignsData, pull } = useCampaignsSnapshot();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | undefined>(undefined);
  const [selectedListingId, setSelectedListingId] = useState<string | undefined>(undefined);
  const [selectedPackageId, setSelectedPackageId] = useState<string | undefined>(undefined);

  const [packages, setPackages] = useState<readonly CreativePackageDto[] | undefined>(undefined);
  const [packagesError, setPackagesError] = useState<string | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | undefined>(undefined);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Same auto-pull-once-if-stale guard `CampaignsHubClient.tsx` established — a fresh cache
  // renders instantly with zero network call, this never turns into a refresh-on-every-visit.
  useEffect(() => {
    const cached = readCampaignsCache();
    if (cached === undefined || !isCacheFresh(cached)) {
      void pull();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const campaigns = useMemo(() => campaignsData?.campaigns ?? [], [campaignsData]);
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId);

  // Same real Campaign->Listing Mapping lookup `CampaignsHubClient.tsx` already uses.
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
        // Best-effort only — the grid below just stays honestly empty for this campaign.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaign?.metaId]);

  const loadPackages = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/creative?limit=200");
      if (!res.ok) {
        throw new Error("Gagal memuat creative packages.");
      }
      const body = (await res.json()) as { packages: readonly CreativePackageDto[] };
      if (mountedRef.current) {
        setPackages(body.packages);
        setPackagesError(undefined);
      }
    } catch (caught) {
      if (mountedRef.current) {
        setPackagesError(
          caught instanceof Error ? caught.message : "Gagal memuat creative packages.",
        );
      }
    }
  }, []);

  useEffect(() => {
    void loadPackages();
  }, [loadPackages]);

  const listingPackages = useMemo(
    () =>
      selectedListingId === undefined
        ? []
        : (packages ?? []).filter((pkg) => pkg.listingId === selectedListingId),
    [packages, selectedListingId],
  );

  const generatingCount = useMemo(
    () => listingPackages.filter((pkg) => pkg.status === "GENERATING").length,
    [listingPackages],
  );

  useEffect(() => {
    if (generatingCount === 0) {
      return;
    }
    const timer = setInterval(() => void loadPackages(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [generatingCount, loadPackages]);

  // A newly-selected campaign, or a real refresh that dropped the previously-selected package,
  // must not leave the Inspector pointing at a stale/foreign package.
  useEffect(() => {
    setSelectedPackageId(undefined);
  }, [selectedListingId]);

  const selectedPackage = listingPackages.find((pkg) => pkg.id === selectedPackageId);

  async function review(pkg: CreativePackageDto, action: "approve" | "reject"): Promise<void> {
    setBusyId(pkg.id);
    try {
      const res = await fetch(`/api/creative/${encodeURIComponent(pkg.id)}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          action === "approve" ? { selectedCopyVariantId: pkg.copyVariants[0]?.id } : {},
        ),
      });
      if (!res.ok) {
        throw new Error(`Gagal ${action === "approve" ? "menyetujui" : "menolak"} package.`);
      }
      await loadPackages();
    } catch (caught) {
      if (mountedRef.current) {
        setPackagesError(caught instanceof Error ? caught.message : "Gagal memproses package.");
      }
    } finally {
      if (mountedRef.current) {
        setBusyId(undefined);
      }
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.campaignPicker}>
        <label htmlFor="kai-studio-campaign-select" className={styles.campaignPickerLabel}>
          Campaign
        </label>
        <select
          id="kai-studio-campaign-select"
          data-testid="kai-studio-campaign-select"
          className={styles.campaignSelect}
          value={selectedCampaignId ?? ""}
          onChange={(event) => setSelectedCampaignId(event.target.value || undefined)}
        >
          <option value="">Pilih campaign…</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </select>
      </div>

      {selectedCampaign === undefined ? (
        <EmptyState
          title="Pilih campaign untuk mulai"
          description="Kai Studio menampilkan brief Samantha, concept grid, dan inspector untuk satu campaign/listing sekaligus — pilih campaign di atas dulu."
        />
      ) : (
        <div className={styles.columns} data-testid="kai-studio-columns">
          <section className={styles.column} data-testid="kai-studio-brief-column">
            <h3 className={styles.columnTitle}>Samantha Brief</h3>
            <CampaignHealthCard
              campaignId={selectedCampaign.metaId}
              campaignName={selectedCampaign.name}
              listingId={selectedListingId}
            />
          </section>

          <section className={styles.column} data-testid="kai-studio-concepts-column">
            <h3 className={styles.columnTitle}>Creative Concepts</h3>
            {selectedListingId === undefined ? (
              <EmptyState
                title="Campaign ini belum terhubung ke listing"
                description="Tidak ada Campaign→Listing Mapping untuk campaign ini, jadi Kai Studio tidak bisa menentukan creative package mana yang relevan."
              />
            ) : packagesError !== undefined && packages === undefined ? (
              <ErrorCard message={packagesError} />
            ) : packages === undefined ? (
              <LoadingSpinner />
            ) : listingPackages.length === 0 ? (
              <EmptyState
                title="Belum ada creative package untuk listing ini"
                description='Gunakan "Brief Kai Sekarang" di kolom Samantha Brief, atau buat brief manual di Creative Hub.'
              />
            ) : (
              <div className={styles.conceptGrid} data-testid="kai-studio-concept-grid">
                {listingPackages.map((pkg) => (
                  <ConceptGridCard
                    key={pkg.id}
                    pkg={pkg}
                    selected={pkg.id === selectedPackageId}
                    onSelect={() => setSelectedPackageId(pkg.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className={styles.column} data-testid="kai-studio-inspector-column">
            <h3 className={styles.columnTitle}>Inspector</h3>
            {selectedPackage === undefined ? (
              <EmptyState
                title="Belum ada concept dipilih"
                description="Pilih salah satu creative concept dari grid untuk melihat detail lengkap dan melakukan review."
              />
            ) : (
              <>
                <PackageStageStepper status={selectedPackage.status} />
                <CreativePackageCard
                  pkg={selectedPackage}
                  busy={busyId === selectedPackage.id}
                  onApprove={() => void review(selectedPackage, "approve")}
                  onReject={() => void review(selectedPackage, "reject")}
                />
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default KaiStudioClient;
