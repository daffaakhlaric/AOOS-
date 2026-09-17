"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type {
  AndromedaHealthDto,
  DiverseCreativeBriefSetResultDto,
} from "@/types/andromeda-health.types";
import type { PendingActionDto } from "@/types/pending-actions.types";

import styles from "./AndromedaHealthCard.module.css";

export interface AndromedaHealthCardProps {
  readonly campaignId: string;
  readonly campaignName: string;
  /**
   * The real, tenant-scoped `listings.id` this campaign maps to, when the caller can honestly
   * resolve one — `creative_packages` (and therefore "Brief Kai sekarang") is fundamentally
   * listing-scoped, not campaign-scoped (see `SchedulerService.createDiverseCreativeBriefSet`'s own
   * doc). Campaign->Listing Mapping (053_meta_campaigns_listing_id.sql) gives `CampaignsHubClient`
   * a real, persisted `meta_campaigns.listing_id` to fetch and pass here — previously (before that
   * migration) no such mapping existed anywhere, only a scheduler-side, in-memory name-substring
   * heuristic (`matchActiveCampaignForListing`), which this prop still never uses. Still `undefined`
   * for a campaign with no real link yet (e.g. one created before that migration/write path
   * existed, or an AUTOMOTIVE campaign) — "Brief Kai sekarang" is then honestly disabled with an
   * explanation, never silently hidden or fabricated as clickable.
   */
  readonly listingId?: string;
}

/**
 * `AndromedaHealthCard` (Samantha Andromeda-Aware Campaign System, Sprint 2) — real per-campaign
 * ad-set count + creative-diversity status (Sprint 1's `scoreCreativeDiversity`/
 * `evaluateAndromedaRestructureCandidate`, exposed here via the new, dedicated
 * `GET /api/campaigns/:campaignId/andromeda-health` live-pull endpoint).
 *
 * PLACEMENT: rendered by `CampaignsHubClient` right after `CampaignInsightPanel` (i.e. "after the
 * campaign table, before Verdict cards" — the pasted spec's own placement instruction), and ONLY
 * for the currently-selected campaign — Sprint 1's own scoring is per-campaign, not per-tenant, so a
 * single always-visible card with no selected campaign would have nothing real to show.
 *
 * APPROVAL-GATE HONESTY: if a real `RESTRUCTURE_CAMPAIGN` `pending_agent_actions` row already exists
 * for this campaign (Sprint 1's scheduler already enqueued it), this card shows a real "menunggu
 * approval Anda" state with a link to `/learning` — the REAL EXISTING pending-actions review surface
 * (`LearningMonitorClient.tsx`'s own "Pending Actions" section, confirmed directly) — rather than a
 * second approve/reject UI. Sprint 1 deliberately built ONLY the backend approval gate
 * (`PendingActionsService.approve`'s `RESTRUCTURE_CAMPAIGN` branch is the sole real Meta-mutation
 * invocation point in this codebase); this card never bypasses that.
 */
export function AndromedaHealthCard({
  campaignId,
  campaignName,
  listingId,
}: AndromedaHealthCardProps): React.ReactElement {
  const [health, setHealth] = useState<AndromedaHealthDto | undefined>(undefined);
  const [healthError, setHealthError] = useState<string | undefined>(undefined);
  const [pendingRow, setPendingRow] = useState<PendingActionDto | undefined | null>(undefined);
  const [briefing, setBriefing] = useState(false);
  const [briefResult, setBriefResult] = useState<DiverseCreativeBriefSetResultDto | undefined>(
    undefined,
  );
  const [briefError, setBriefError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setHealth(undefined);
    setHealthError(undefined);
    setBriefResult(undefined);
    setBriefError(undefined);
    fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/andromeda-health`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat Andromeda Health.");
        }
        const body = (await res.json()) as Partial<AndromedaHealthDto>;
        // Defensive, honest shape check — a malformed/unexpected response body must degrade to the
        // real error state below, never crash the whole `/campaigns` page render tree.
        if (
          body.diversity === undefined ||
          body.evaluation === undefined ||
          typeof body.adSetCount !== "number"
        ) {
          throw new Error("Respons Andromeda Health tidak lengkap.");
        }
        return body as AndromedaHealthDto;
      })
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setHealthError(
            caught instanceof Error ? caught.message : "Gagal memuat Andromeda Health.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  useEffect(() => {
    let cancelled = false;
    setPendingRow(undefined);
    fetch("/api/pending-actions?status=PENDING")
      .then((res) => (res.ok ? (res.json() as Promise<readonly PendingActionDto[]>) : []))
      .then((rows) => {
        if (cancelled) return;
        const match = rows.find(
          (row) =>
            row.actionType === "RESTRUCTURE_CAMPAIGN" && row.payload["campaignId"] === campaignId,
        );
        setPendingRow(match ?? null);
      })
      .catch(() => {
        if (!cancelled) setPendingRow(null);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  function handleBriefKai(): void {
    if (listingId === undefined) return;
    setBriefing(true);
    setBriefError(undefined);
    setBriefResult(undefined);
    fetch("/api/creative-packages/diverse-set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ listingId, campaignId, requestedCount: 5 }),
    })
      .then(async (res) => {
        const body = (await res.json()) as
          DiverseCreativeBriefSetResultDto | { readonly error: { readonly message: string } };
        if (!res.ok || "error" in body) {
          throw new Error("error" in body ? body.error.message : "Gagal membuat brief.");
        }
        return body;
      })
      .then((data) => setBriefResult(data))
      .catch((caught: unknown) => {
        setBriefError(caught instanceof Error ? caught.message : "Gagal membuat brief.");
      })
      .finally(() => setBriefing(false));
  }

  if (healthError !== undefined) {
    return (
      <section data-testid="andromeda-health-card" className={styles.section}>
        <h3 className={styles.title}>Andromeda Health — {campaignName}</h3>
        <p className={styles.errorBox}>{healthError}</p>
      </section>
    );
  }

  if (health === undefined) {
    return (
      <section data-testid="andromeda-health-card" className={styles.section}>
        <h3 className={styles.title}>Andromeda Health — {campaignName}</h3>
        <LoadingSpinner />
      </section>
    );
  }

  const { diversity, evaluation, adSetCount } = health;
  const badgeClass =
    diversity.status === "DIVERSE"
      ? styles.badgeDiverse
      : diversity.status === "LOW_DIVERSITY"
        ? styles.badgeLow
        : styles.badgeNotEnough;
  const badgeLabel =
    diversity.status === "DIVERSE"
      ? "Diverse"
      : diversity.status === "LOW_DIVERSITY"
        ? "Low Diversity"
        : "Data Belum Cukup";

  const isRestructureCandidate = evaluation.triggered;

  return (
    <section data-testid="andromeda-health-card" className={styles.section}>
      <h3 className={styles.title}>Andromeda Health — {campaignName}</h3>
      <div className={styles.statsRow}>
        <span className={styles.stat}>
          Ad Set: <span className={styles.statValue}>{adSetCount}</span>
        </span>
        <span className={styles.stat}>
          Total Ad: <span className={styles.statValue}>{diversity.totalAdCount}</span>
        </span>
        {diversity.distinctCreativeAssetCount !== undefined ? (
          <span className={styles.stat}>
            Creative Unik:{" "}
            <span className={styles.statValue}>{diversity.distinctCreativeAssetCount}</span>
          </span>
        ) : null}
        <span data-testid="diversity-badge" className={`${styles.badge} ${badgeClass}`}>
          {badgeLabel}
        </span>
      </div>
      <p className={styles.reasoning}>{diversity.reasoning}</p>

      {isRestructureCandidate && pendingRow !== undefined && pendingRow !== null ? (
        <div data-testid="pending-approval-box" className={styles.pendingBox}>
          Samantha sudah mendeteksi campaign ini sebagai kandidat restructure (gaya Andromeda) dan
          menunggu approval Anda.{" "}
          <Link href="/learning" className={styles.pendingLink}>
            Review di Pending Actions →
          </Link>
        </div>
      ) : null}

      {diversity.status !== "DIVERSE" && briefResult === undefined ? (
        <>
          <button
            type="button"
            data-testid="brief-kai-button"
            className={styles.briefButton}
            disabled={briefing || listingId === undefined}
            onClick={handleBriefKai}
          >
            {briefing ? "Membuat brief..." : "Brief Kai sekarang"}
          </button>
          {listingId === undefined ? (
            <p className={styles.reasoning}>
              Tidak bisa menentukan listing untuk campaign ini secara otomatis — buat brief manual
              di halaman Listing.
            </p>
          ) : null}
          {briefError !== undefined ? <p className={styles.errorBox}>{briefError}</p> : null}
        </>
      ) : null}

      {briefResult !== undefined ? (
        <div data-testid="brief-result-box" className={styles.successBox}>
          {briefResult.createdCount > 0
            ? `${String(briefResult.createdCount)} brief kreatif baru dibuat dan masuk ke antrian review Creative Packages.`
            : (briefResult.skippedReason ?? "Tidak ada brief baru yang dibuat.")}
          {briefResult.cappedByDailyLimit
            ? ` (Diminta ${String(briefResult.requestedCount)}, dibatasi kuota harian ke ${String(briefResult.allowedCount)}.)`
            : ""}
        </div>
      ) : null}
    </section>
  );
}

export default AndromedaHealthCard;
