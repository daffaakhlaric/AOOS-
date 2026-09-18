"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { OpportunitiesResponseDto, OpportunityDto } from "@/types/opportunities.types";

import styles from "./OpportunitiesCard.module.css";

export interface OpportunitiesCardProps {
  readonly campaignId: string;
  readonly campaignName: string;
}

const OPPORTUNITY_TYPE_LABELS: Record<OpportunityDto["type"], string> = {
  SCALING_OPPORTUNITY: "Peluang Scaling",
  CREATIVE_WINNER_EXPANSION: "Angle Creative Terbaik",
};

/**
 * `OpportunitiesCard` (EYVRA — SAMANTHA V2 + KAI V2 Phase 13) — real per-campaign opportunity
 * findings from Phase 9's Opportunity Engine (`GET /api/v1/opportunities/:campaignId`): scaling
 * opportunities derived from Campaign Health's real `SCALE` decisions (Phase 4), and creative-
 * winner-expansion opportunities derived from Creative Memory's real rank-1 angles (Phase 2). Both
 * are pure, deterministic detectors over already-computed data — no LLM call, no fabrication.
 *
 * PLACEMENT: rendered by `CampaignsHubClient` right after `AndromedaHealthCard`, and ONLY for the
 * currently-selected campaign — same reason `AndromedaHealthCard` is per-campaign-gated: the
 * Opportunity Engine's detectors are single-campaign, not tenant-wide, so a single always-visible
 * card with no selected campaign would have nothing real to show.
 */
export function OpportunitiesCard({
  campaignId,
  campaignName,
}: OpportunitiesCardProps): React.ReactElement {
  const [data, setData] = useState<OpportunitiesResponseDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    setError(undefined);
    fetch(`/api/opportunities/${encodeURIComponent(campaignId)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat Opportunities.");
        }
        const body = (await res.json()) as Partial<OpportunitiesResponseDto>;
        // Defensive, honest shape check — a malformed/unexpected response body must degrade to the
        // real error state below, never crash the whole `/campaigns` page render tree.
        if (!Array.isArray(body.opportunities)) {
          throw new Error("Respons Opportunities tidak lengkap.");
        }
        return body as OpportunitiesResponseDto;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat Opportunities.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  if (error !== undefined) {
    return (
      <section data-testid="opportunities-card" className={styles.section}>
        <h3 className={styles.title}>Opportunities — {campaignName}</h3>
        <p className={styles.errorBox}>{error}</p>
      </section>
    );
  }

  if (data === undefined) {
    return (
      <section data-testid="opportunities-card" className={styles.section}>
        <h3 className={styles.title}>Opportunities — {campaignName}</h3>
        <LoadingSpinner />
      </section>
    );
  }

  if (data.opportunities.length === 0) {
    return (
      <section data-testid="opportunities-card" className={styles.section}>
        <h3 className={styles.title}>Opportunities — {campaignName}</h3>
        <EmptyState
          title="Belum ada opportunity"
          description="Belum ada opportunity nyata terdeteksi untuk campaign ini saat ini."
        />
      </section>
    );
  }

  return (
    <section data-testid="opportunities-card" className={styles.section}>
      <h3 className={styles.title}>Opportunities — {campaignName}</h3>
      <div className={styles.list}>
        {data.opportunities.map((opportunity, index) => (
          <div
            key={`${opportunity.type}-${String(index)}`}
            data-testid="opportunity-row"
            className={styles.row}
          >
            <div className={styles.rowHeader}>
              <span data-testid="opportunity-type-label" className={styles.typeLabel}>
                {OPPORTUNITY_TYPE_LABELS[opportunity.type]}
              </span>
              <span data-testid="opportunity-confidence" className={styles.confidence}>
                {Math.round(opportunity.confidence * 100)}%
              </span>
            </div>
            <p className={styles.description}>{opportunity.description}</p>
            <p className={styles.evidence}>{opportunity.evidence}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default OpportunitiesCard;
