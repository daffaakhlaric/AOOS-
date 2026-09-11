"use client";

import { useState } from "react";

import { VerdictBadge } from "@/components/meta-ads/VerdictBadge";
import { stripAdNameSuffix } from "@/lib/adName";
import { formatIdr, formatNumber } from "@/lib/formatters";
import type {
  AdSetSummaryDto,
  AdSummaryDto,
  CampaignSummaryDto,
  DiagnoseAdCopyRequestDto,
  DiagnoseAdCopyResponseDto,
} from "@/types/dashboard.types";

import { rphChatIDR as rphChat } from "./campaignInsightMath";
import styles from "./CampaignAdDrillDown.module.css";

export interface CampaignAdDrillDownProps {
  readonly campaign: CampaignSummaryDto;
}

/** Real "is this ad underperforming" signal, reusing the exact verdicts `VerdictEngine` considers stop-and-act (`FIX`/`PAUSE`) plus the uncertain `REVIEW` bucket — never a new threshold invented client-side, matching `DiagnoseAdCopyRequestSchema.isUnderperforming`'s own docstring ("berdasarkan verdict nyata di atas, bukan threshold baru"). */
function isUnderperforming(verdict: string): boolean {
  return verdict === "FIX" || verdict === "PAUSE" || verdict === "REVIEW";
}

const KNOWN_LEARNING_STATUSES = ["LEARNING", "LEARNING_LIMITED", "SUCCESS"] as const;
type KnownLearningStatus = (typeof KNOWN_LEARNING_STATUSES)[number];

function toKnownLearningStatus(value: string | undefined): KnownLearningStatus | undefined {
  return (KNOWN_LEARNING_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as KnownLearningStatus)
    : undefined;
}

function buildDiagnoseRequest(ad: AdSummaryDto, adSet: AdSetSummaryDto): DiagnoseAdCopyRequestDto {
  return {
    adName: ad.name,
    primaryText: ad.primaryText,
    headline: ad.headline,
    description: ad.description,
    verdict: ad.verdict,
    isUnderperforming: isUnderperforming(ad.verdict),
    spend: ad.metrics.spend,
    conversations: ad.metrics.conversations,
    rphChatIDR: rphChat(ad.metrics.spend, ad.metrics.conversations),
    frequency: ad.metrics.frequency,
    learningStatus: toKnownLearningStatus(adSet.learningStatus),
  };
}

type DiagnosisState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly data: DiagnoseAdCopyResponseDto }
  | { readonly status: "error"; readonly message: string };

const STRUCTURAL_LABELS = {
  hook: "Hook",
  clearProblem: "Clear Problem",
  toThePoint: "To The Point",
  softCta: "Soft CTA",
} as const;

const STRUCTURAL_STATUS_LABEL: Readonly<Record<string, string>> = {
  YES: "YA",
  NO: "TIDAK",
  PARTIAL: "SEBAGIAN",
};

const ISSUE_LABEL: Readonly<Record<string, string>> = {
  PAIN: "Pain tidak ada",
  OFFER: "Offer kurang menarik",
  USP: "USP tidak ada",
  UNCERTAIN: "Belum bisa dipastikan",
};

function structuralClass(status: string): string {
  switch (status) {
    case "YES":
      return styles.structYes ?? "";
    case "PARTIAL":
      return styles.structPartial ?? "";
    default:
      return styles.structNo ?? "";
  }
}

type AvailableDiagnosis = Extract<DiagnoseAdCopyResponseDto, { readonly available: true }>;

/** Renders one loaded, `available: true` diagnosis — split out from `AdCopyDiagnosisPanel` purely so `payload`'s type is narrowed once at the call site, not re-checked inside a `.map` closure. */
function AdCopyDiagnosisResult({
  adId,
  payload,
}: {
  readonly adId: string;
  readonly payload: AvailableDiagnosis;
}): React.ReactElement {
  return (
    <div data-testid={`diagnosis-result-${adId}`} className={styles.diagnosisResult}>
      {payload.learningPhaseNote !== undefined ? (
        <p className={styles.learningNote} data-testid={`diagnosis-learning-note-${adId}`}>
          🎓 {payload.learningPhaseNote}
        </p>
      ) : null}
      <ul className={styles.structuralList}>
        {(Object.keys(STRUCTURAL_LABELS) as (keyof typeof STRUCTURAL_LABELS)[]).map((key) => {
          const element = payload.structural[key];
          return (
            <li key={key} className={styles.structuralItem}>
              <span className={`${styles.structuralBadge} ${structuralClass(element.status)}`}>
                {STRUCTURAL_LABELS[key]}:{" "}
                {STRUCTURAL_STATUS_LABEL[element.status] ?? element.status}
              </span>
              <span className={styles.structuralReasoning}>{element.reasoning}</span>
            </li>
          );
        })}
      </ul>
      {payload.diagnosis !== undefined ? (
        <p className={styles.diagnosisIssue} data-testid={`diagnosis-issue-${adId}`}>
          <strong>{ISSUE_LABEL[payload.diagnosis.issue] ?? payload.diagnosis.issue}</strong>
          {" — "}
          {payload.diagnosis.reasoning}
        </p>
      ) : null}
    </div>
  );
}

/**
 * "Diagnosa Samantha" — one ad's structural + Pain/Offer/USP ad-copy diagnosis, fetched on demand
 * from `POST /api/ads/diagnose-copy` (Samantha Advanced Sprint 1). Honest degrade: `available:
 * false` renders the real reason's Indonesian message (`NO_COPY_TEXT`/`NO_API_KEY`/`RATE_LIMITED`/
 * `PROVIDER_ERROR`/`INVALID_RESPONSE`) instead of a fabricated diagnosis, same discipline every
 * other real LLM-backed surface in this app follows (`CampaignInsightPanel`'s own "belum tersedia").
 */
function AdCopyDiagnosisPanel({
  ad,
  adSet,
}: {
  readonly ad: AdSummaryDto;
  readonly adSet: AdSetSummaryDto;
}): React.ReactElement {
  const [state, setState] = useState<DiagnosisState>({ status: "idle" });

  function runDiagnosis(): void {
    if (state.status === "loading") {
      return;
    }
    setState({ status: "loading" });
    fetch("/api/ads/diagnose-copy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildDiagnoseRequest(ad, adSet)),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat diagnosa Samantha.");
        }
        return (await res.json()) as DiagnoseAdCopyResponseDto;
      })
      .then((data) => setState({ status: "loaded", data }))
      .catch((caught: unknown) => {
        setState({
          status: "error",
          message: caught instanceof Error ? caught.message : "Gagal memuat diagnosa Samantha.",
        });
      });
  }

  return (
    <div className={styles.diagnosisPanel} data-testid={`diagnosis-panel-${ad.id}`}>
      {state.status === "idle" ? (
        <button
          type="button"
          data-testid={`diagnose-button-${ad.id}`}
          onClick={runDiagnosis}
          className={styles.diagnoseButton}
        >
          🩺 Diagnosa Samantha
        </button>
      ) : null}
      {state.status === "loading" ? (
        <p className={styles.diagnosisLoading} data-testid={`diagnosis-loading-${ad.id}`}>
          Menganalisa copy iklan…
        </p>
      ) : null}
      {state.status === "error" ? (
        <p className={styles.diagnosisUnavailable} data-testid={`diagnosis-unavailable-${ad.id}`}>
          {state.message}
        </p>
      ) : null}
      {state.status === "loaded" && state.data.available ? (
        <AdCopyDiagnosisResult adId={ad.id} payload={state.data} />
      ) : null}
      {state.status === "loaded" && !state.data.available ? (
        <p className={styles.diagnosisUnavailable} data-testid={`diagnosis-unavailable-${ad.id}`}>
          {state.data.message}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Samantha Advanced Sprint 1 — real per-ad-set → per-ad drill-down for `CampaignInsightPanel`.
 *
 * INVESTIGATION FINDING (this dispatch): `CampaignTree.tsx`'s own docstring claims it "powers the
 * real per-ad-set/ad drill-down inside `CampaignInsightPanel`'s 'detail' affordance" — but reading
 * `CampaignInsightPanel.tsx` in full shows it imports ONLY `aggregateVerdict` from `CampaignTree`,
 * never the `CampaignTree` component itself, and renders no ad-set/ad hierarchy at all.
 * `CampaignTree` is real and fully functional, but is wired into a DIFFERENT page
 * (`MetaAdsClient.tsx`, the legacy `/meta-ads` route) — it is genuinely unreachable from the real
 * unified `/campaigns` page today. Rather than retrofit `CampaignTree` (which renders a full
 * multi-campaign list plus its own `CampaignDetailDrawer` overlay — the wrong shape for "already
 * inside one selected campaign's panel") or silently leave the doc comment's claim uncorrected,
 * this is a new, minimal expand/collapse component scoped to ONE campaign's own `adSets`, built to
 * live inside `CampaignInsightPanel` (the real, current detail-affordance location) and reusing
 * `VerdictBadge`/`stripAdNameSuffix`/the campaign-card visual conventions `CampaignTree` already
 * established, rather than duplicating a second styling language.
 */
export function CampaignAdDrillDown({ campaign }: CampaignAdDrillDownProps): React.ReactElement {
  const [expandedAdSets, setExpandedAdSets] = useState<Record<string, boolean>>({});

  function toggleAdSet(adSetId: string): void {
    setExpandedAdSets((prev) => ({ ...prev, [adSetId]: !(prev[adSetId] ?? false) }));
  }

  if (campaign.adSets.length === 0) {
    return (
      <p className={styles.empty} data-testid="ad-drilldown-empty">
        Belum ada ad set untuk campaign ini.
      </p>
    );
  }

  return (
    <div className={styles.wrapper} data-testid="ad-drilldown">
      {campaign.adSets.map((adSet) => {
        const isExpanded = expandedAdSets[adSet.id] ?? false;
        const isAdSetLearning = adSet.learningStatus === "LEARNING";
        return (
          <div key={adSet.id} className={styles.adSetRow}>
            <button
              type="button"
              data-testid={`open-adset-${adSet.id}`}
              onClick={() => toggleAdSet(adSet.id)}
              aria-expanded={isExpanded}
              className={styles.adSetHeaderButton}
            >
              <span aria-hidden="true" className={styles.chevron}>
                {isExpanded ? "▼" : "▶"}
              </span>
              <span className={styles.idBadge}>{adSet.stableId}</span>
              <span className={styles.adSetName}>{stripAdNameSuffix(adSet.name)}</span>
              {isAdSetLearning ? (
                <span
                  data-testid={`learning-badge-adset-${adSet.id}`}
                  className={styles.learningBadge}
                  title="Ad set ini masih dalam Learning Phase Meta — evaluasi performa sebenarnya baru akurat setelah keluar dari fase ini."
                >
                  🎓 Learning
                </span>
              ) : null}
              <span className={styles.adSetMeta}>
                {adSet.ads.length} iklan · {formatIdr(adSet.spend)}
              </span>
            </button>
            {isExpanded ? (
              <div className={styles.adList}>
                {adSet.ads.map((ad) => (
                  <div key={ad.id} className={styles.adRow} data-testid={`ad-row-${ad.id}`}>
                    <div className={styles.adTopRow}>
                      <span className={styles.idBadge}>{ad.stableId}</span>
                      <span className={styles.adName}>{stripAdNameSuffix(ad.name)}</span>
                      <VerdictBadge verdict={ad.verdict} />
                      <span className={styles.adMetric}>{formatIdr(ad.metrics.spend)}</span>
                      <span className={styles.adMetric}>
                        {formatNumber(ad.metrics.conversations)} chat
                      </span>
                    </div>
                    <AdCopyDiagnosisPanel ad={ad} adSet={adSet} />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default CampaignAdDrillDown;
