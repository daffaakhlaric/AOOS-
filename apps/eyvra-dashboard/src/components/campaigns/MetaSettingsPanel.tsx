"use client";

import { useState } from "react";

import { formatIdr } from "@/lib/formatters";
import type {
  CreativePackageDto,
  MetaCreativeCopyDto,
  MetaSettingsRecommendationResponseDto,
} from "@/types/dashboard.types";

import styles from "./MetaSettingsPanel.module.css";

type AvailableRecommendation = Extract<MetaSettingsRecommendationResponseDto, { available: true }>;

export interface MetaSettingsPanelProps {
  readonly recommendation: AvailableRecommendation;
  /**
   * The real, tenant-scoped `listings.id` this campaign maps to, when the caller can honestly
   * resolve one — same real gap `AndromedaHealthCard.tsx`'s own `listingId` prop documents (no
   * persisted campaign→listing mapping exists anywhere in this codebase's real data model). When
   * `undefined`, every "Brief Kai" button below is honestly disabled with an explanation, never
   * silently hidden or fabricated as clickable.
   */
  readonly listingId?: string;
}

type TabKey = "audience" | "campaign" | "copy" | "abtest";

const TABS: readonly { readonly key: TabKey; readonly label: (count: number) => string }[] = [
  { key: "audience", label: () => "Audience & Targeting" },
  { key: "campaign", label: () => "Campaign Settings" },
  { key: "copy", label: (count) => `Creative Copy (${count})` },
  { key: "abtest", label: () => "A/B Test Plan" },
];

const ANGLE_LABEL: Record<string, string> = {
  DP_RINGAN: "DP RINGAN",
  READY_HUNI: "READY HUNI",
  INVESTASI: "INVESTASI",
  EXCLUSIVE: "EXCLUSIVE",
  SYARIAH: "SYARIAH",
  PROMO_TERBATAS: "PROMO TERBATAS",
  TESTIMONIAL: "TESTIMONIAL",
  VIRTUAL_TOUR: "VIRTUAL TOUR",
};

const FIELD_LIMITS: Readonly<Record<string, number>> = {
  HEADLINE: 27,
  DESCRIPTION: 30,
  "PRIMARY TEXT": 125,
};

/**
 * SAMANTHA META ADS SETTINGS + CREATIVE COPY — real Meta Ads settings recommendation + 8-angle
 * creative copy for ONE campaign, rendered as a lazy-loaded accordion below `CampaignInsightPanel`'s
 * diagnosis (see that component's own wiring). Every recommendation here is advisory text for a
 * human media buyer to apply manually in Meta Ads Manager — see `aaos-api`'s
 * `MetaSettingsRecommendationLlmPayloadSchema` for why there is deliberately no "apply settings"
 * mutation and no Meta geo/interest ID anywhere in this panel (neither has real backing in this
 * codebase: `IMetaAdsClient` has no targeting-update method, and `SearchAdInterests`/
 * `SearchAdLocations` are read-only, live-query-only).
 *
 * "Brief Kai" per copy reuses the REAL `POST /api/v1/creative-packages/property` manual-brief
 * endpoint (`angle` constrained to the real 8-member `PropertyAdAngle` enum — see this feature's
 * backend DTO for why that enum, not the pasted spec's fabricated one, is what makes this button
 * work end-to-end) — honestly disabled without a real `listingId`, same convention
 * `AndromedaHealthCard.tsx`'s own "Brief Kai sekarang" button already establishes.
 */
export function MetaSettingsPanel({
  recommendation: r,
  listingId,
}: MetaSettingsPanelProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TabKey>("audience");
  const [expandedCopy, setExpandedCopy] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [briefingAngle, setBriefingAngle] = useState<string | null>(null);
  const [briefResults, setBriefResults] = useState<Record<string, string>>({});

  async function copyToClipboard(text: string, id: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Best-effort only — clipboard access can genuinely fail (permissions, non-secure context).
    }
  }

  async function briefKai(copy: MetaCreativeCopyDto): Promise<void> {
    if (listingId === undefined) return;
    setBriefingAngle(copy.angle);
    try {
      const res = await fetch("/api/creative-packages/property", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          listingId,
          angle: copy.angle,
          primaryMessage: copy.hook,
          format: copy.recommendedFormat,
          origin: "SAMANTHA",
          reason: copy.whyThisWorks,
          aiRecommended: true,
          generate: true,
        }),
      });
      const body = (await res.json()) as
        CreativePackageDto | { readonly error: { readonly message: string } };
      if (!res.ok || "error" in body) {
        setBriefResults((prev) => ({
          ...prev,
          [copy.angle]: "error" in body ? body.error.message : "Gagal membuat brief.",
        }));
      } else {
        setBriefResults((prev) => ({ ...prev, [copy.angle]: "Brief dibuat, masuk antrian Kai." }));
      }
    } catch {
      setBriefResults((prev) => ({ ...prev, [copy.angle]: "Gagal membuat brief." }));
    } finally {
      setBriefingAngle(null);
    }
  }

  return (
    <div data-testid="meta-settings-panel" className={styles.panel}>
      <div className={styles.summaryBar}>
        <div style={{ flex: 1 }}>
          <p className={styles.summaryLabel}>Rekomendasi Settings Samantha</p>
          <p className={styles.summaryText} data-testid="settings-one-liner">
            {r.settingsSummaryCard.oneLineRecommendation}
          </p>
        </div>
        <div className={styles.summaryImpact}>
          <div className={styles.summaryImpactLabel}>Estimasi Dampak</div>
          <div className={styles.summaryImpactValue}>{r.settingsSummaryCard.estimatedImpact}</div>
        </div>
      </div>

      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            data-testid={`settings-tab-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            className={`${styles.tabButton} ${activeTab === tab.key ? styles.tabButtonActive : ""}`}
          >
            {tab.label(r.creativeRecommendations.copies.length)}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {activeTab === "audience" ? (
          <div
            data-testid="settings-tab-panel-audience"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div className={styles.strategyBanner}>
              <span className={styles.strategyBadge}>{r.audienceSettings.strategy}</span>
              <span className={styles.strategyText}>{r.audienceSettings.strategyRationale}</span>
            </div>

            <div>
              <p className={styles.blockLabel}>Geo Targeting</p>
              {r.audienceSettings.geoTargeting.locations.map((loc, i) => (
                <div key={i} className={styles.geoRow}>
                  <div style={{ flex: 1 }}>
                    <div className={styles.geoName}>{loc.name}</div>
                    <div className={styles.geoRationale}>{loc.radiusRationale}</div>
                  </div>
                  <span className={styles.geoRadius}>+{loc.radiusKm} km</span>
                </div>
              ))}
              <p className={styles.note}>{r.audienceSettings.geoTargeting.geoRationale}</p>
              <p className={styles.note}>
                Nama lokasi di atas hanya titik awal pencarian — cari ID lokasi asli secara live di
                Meta Ads Manager, jangan pernah gunakan angka ID yang tidak berasal dari sana.
              </p>
            </div>

            <div>
              <p className={styles.blockLabel}>Demografi</p>
              <div className={styles.demoGrid}>
                <div className={styles.demoCell}>
                  <div className={styles.demoCellLabel}>Usia</div>
                  <div className={styles.demoCellValue}>
                    {r.audienceSettings.demographics.ageMin}–
                    {r.audienceSettings.demographics.ageMax} th
                  </div>
                </div>
                <div className={styles.demoCell}>
                  <div className={styles.demoCellLabel}>Gender</div>
                  <div className={styles.demoCellValue}>
                    {r.audienceSettings.demographics.gender === "all"
                      ? "Semua"
                      : r.audienceSettings.demographics.gender}
                  </div>
                </div>
                <div className={styles.demoCell}>
                  <div className={styles.demoCellLabel}>Special Cat.</div>
                  <div className={styles.demoCellValue}>
                    {r.audienceSettings.specialAdCategory.category}
                  </div>
                </div>
              </div>
              <p className={styles.warnNote}>
                ⚠ {r.audienceSettings.specialAdCategory.implications}
              </p>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <p className={styles.blockLabel} style={{ margin: 0 }}>
                  Interest Targeting
                </p>
                <span
                  className={`${styles.interestBadge} ${r.audienceSettings.interestTargeting.use ? styles.interestBadgeOn : styles.interestBadgeOff}`}
                >
                  {r.audienceSettings.interestTargeting.use
                    ? "Direkomendasikan"
                    : "Skip — gunakan Broad"}
                </span>
              </div>
              <p className={styles.note} style={{ marginTop: 0 }}>
                {r.audienceSettings.interestTargeting.useRationale}
              </p>
              {r.audienceSettings.interestTargeting.use ? (
                <div className={styles.interestChips}>
                  {r.audienceSettings.interestTargeting.interests.map((interest, i) => (
                    <div key={i} className={styles.interestChip}>
                      <div className={styles.interestChipName}>{interest.name}</div>
                      <div className={styles.interestChipRelevance}>{interest.relevance}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className={styles.audienceGrid}>
              <div
                className={`${styles.audienceCard} ${r.audienceSettings.customAudiences.retargeting.recommended ? styles.audienceCardOn : ""}`}
              >
                <div className={styles.audienceCardHeader}>
                  <span className={styles.audienceCardLabel}>Retargeting WA Leads</span>
                  <span
                    className={`${styles.audienceCardStatus} ${r.audienceSettings.customAudiences.retargeting.recommended ? styles.audienceCardStatusOn : styles.audienceCardStatusOff}`}
                  >
                    {r.audienceSettings.customAudiences.retargeting.recommended ? "✓ Ya" : "– Skip"}
                  </span>
                </div>
                <div className={styles.audienceCardNote}>
                  {r.audienceSettings.customAudiences.retargeting.rationale}
                </div>
              </div>
              <div
                className={`${styles.audienceCard} ${r.audienceSettings.customAudiences.lookalike.recommended ? styles.audienceCardOn : ""}`}
              >
                <div className={styles.audienceCardHeader}>
                  <span className={styles.audienceCardLabel}>Lookalike Audience</span>
                  <span
                    className={`${styles.audienceCardStatus} ${r.audienceSettings.customAudiences.lookalike.recommended ? styles.audienceCardStatusOn : styles.audienceCardStatusOff}`}
                  >
                    {r.audienceSettings.customAudiences.lookalike.recommended ? "✓ Ya" : "– Skip"}
                  </span>
                </div>
                <div className={styles.audienceCardNote}>
                  {r.audienceSettings.customAudiences.lookalike.rationale}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "campaign" ? (
          <div
            data-testid="settings-tab-panel-campaign"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div className={styles.settingsGrid}>
              {[
                {
                  label: "Objective",
                  value: r.campaignSettings.objective,
                  note: r.campaignSettings.objectiveRationale,
                },
                {
                  label: "Bid Strategy",
                  value: r.campaignSettings.bidStrategy,
                  note: r.campaignSettings.bidStrategyRationale,
                },
                {
                  label: "Optimization Goal",
                  value: r.adSetSettings.optimizationGoal,
                  note: r.adSetSettings.optimizationRationale,
                },
                {
                  label: "Placements",
                  value: r.adSetSettings.placementStrategy.type,
                  note: r.adSetSettings.placementStrategy.rationale,
                },
              ].map((s) => (
                <div key={s.label} className={styles.settingCard}>
                  <p className={styles.settingLabel}>{s.label}</p>
                  <p className={styles.settingValue}>{s.value}</p>
                  <p className={styles.settingNote}>{s.note}</p>
                </div>
              ))}
            </div>

            <div className={styles.budgetBlock}>
              <p className={styles.blockLabel} style={{ color: "#1e40af" }}>
                Budget Recommendation
              </p>
              <div className={styles.budgetGrid}>
                {[
                  {
                    label: "Minimum viable",
                    value: r.adSetSettings.budgetRecommendation.minViable,
                  },
                  {
                    label: "Direkomendasikan",
                    value: r.adSetSettings.budgetRecommendation.dailyBudget,
                    highlight: true,
                  },
                  {
                    label: "Ideal (learning)",
                    value: r.adSetSettings.budgetRecommendation.idealForLearning,
                  },
                ].map((b) => (
                  <div
                    key={b.label}
                    className={`${styles.budgetCell} ${b.highlight ? styles.budgetCellHighlight : ""}`}
                  >
                    <div className={styles.budgetCellValue}>{formatIdr(b.value)}</div>
                    <div className={styles.budgetCellLabel}>{b.label}</div>
                  </div>
                ))}
              </div>
              <p className={styles.budgetRationale}>
                {r.adSetSettings.budgetRecommendation.rationale}
              </p>
            </div>

            <div>
              <p className={styles.blockLabel}>Placements yang Diaktifkan</p>
              <div className={styles.placementChips}>
                {r.adSetSettings.placementStrategy.placements.map((p) => (
                  <span key={p} className={styles.placementChip}>
                    ✓ {p}
                  </span>
                ))}
              </div>
              {r.adSetSettings.placementStrategy.excluded.length > 0 ? (
                <p className={styles.note}>
                  Excluded: {r.adSetSettings.placementStrategy.excluded.join(", ")}
                </p>
              ) : null}
            </div>

            <div className={styles.trackingBlock}>
              <p className={styles.blockLabel} style={{ color: "#7c3aed" }}>
                Tracking Setup
              </p>
              <div className={styles.trackingTemplate}>{r.trackingSetup.utmParams.template}</div>
              <div className={styles.trackingNote}>WA Link: {r.trackingSetup.waLinkSetup}</div>
            </div>
          </div>
        ) : null}

        {activeTab === "copy" ? (
          <div
            data-testid="settings-tab-panel-copy"
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            {r.creativeRecommendations.copyPrinciples.length > 0 ? (
              <div className={styles.principlesBox}>
                <p className={styles.principlesTitle}>Prinsip copy untuk listing ini:</p>
                {r.creativeRecommendations.copyPrinciples.map((p, i) => (
                  <p key={i} className={styles.principleItem}>
                    • {p}
                  </p>
                ))}
              </div>
            ) : null}

            {r.creativeRecommendations.copies.map((copy, i) => {
              const isExpanded = expandedCopy === copy.angle;
              const fields: readonly { readonly label: string; readonly value: string }[] = [
                { label: "HOOK", value: copy.hook },
                { label: "HEADLINE", value: copy.headline },
                { label: "PRIMARY TEXT", value: copy.primaryText },
                { label: "DESCRIPTION", value: copy.description },
                { label: "CTA BUTTON", value: copy.cta },
              ];
              return (
                <div
                  key={copy.angle}
                  className={styles.copyCard}
                  data-testid={`copy-card-${copy.angle}`}
                >
                  <div
                    onClick={() => setExpandedCopy(isExpanded ? null : copy.angle)}
                    className={`${styles.copyCardHeader} ${isExpanded ? styles.copyCardHeaderExpanded : ""}`}
                    data-testid={`copy-card-header-${copy.angle}`}
                  >
                    <div className={styles.copyNumber}>{i + 1}</div>
                    <div className={styles.copyHeaderBody}>
                      <div className={styles.copyHeaderTop}>
                        <span className={styles.angleBadge}>
                          {ANGLE_LABEL[copy.angle] ?? copy.angle}
                        </span>
                        <span className={styles.personaText}>→ {copy.targetPersona}</span>
                        <span className={styles.formatChip}>{copy.recommendedFormat}</span>
                      </div>
                      <div className={styles.hookPreview}>&quot;{copy.hook}&quot;</div>
                    </div>
                    <span className={styles.chevron}>{isExpanded ? "▲" : "▼"}</span>
                  </div>

                  {isExpanded ? (
                    <div className={styles.copyCardBody}>
                      {fields.map((field) => {
                        const limit = FIELD_LIMITS[field.label];
                        const over = limit !== undefined && field.value.length > limit;
                        const fieldId = `${copy.angle}_${field.label}`;
                        return (
                          <div key={field.label} className={styles.copyField}>
                            <div className={styles.copyFieldHeader}>
                              <span>
                                <span className={styles.copyFieldLabel}>{field.label}</span>
                                {limit !== undefined ? (
                                  <span className={styles.copyFieldLimit}>
                                    · max {limit} karakter
                                  </span>
                                ) : null}
                              </span>
                              <button
                                type="button"
                                onClick={() => void copyToClipboard(field.value, fieldId)}
                                className={`${styles.copyButton} ${copiedId === fieldId ? styles.copyButtonCopied : ""}`}
                              >
                                {copiedId === fieldId ? "Tersalin!" : "Copy"}
                              </button>
                            </div>
                            <div className={styles.copyFieldValue}>{field.value}</div>
                            {limit !== undefined ? (
                              <div
                                className={`${styles.copyFieldCount} ${over ? styles.copyFieldCountOver : ""}`}
                              >
                                {field.value.length} karakter
                              </div>
                            ) : null}
                          </div>
                        );
                      })}

                      <div className={styles.visualDirectionBox}>
                        <p className={styles.visualDirectionLabel}>VISUAL DIRECTION</p>
                        <p className={styles.visualDirectionText}>{copy.visualDirection}</p>
                      </div>

                      <div className={styles.whyThisWorksBox}>
                        <strong>Kenapa ini akan bekerja:</strong> {copy.whyThisWorks}
                      </div>

                      <button
                        type="button"
                        data-testid={`brief-kai-${copy.angle}`}
                        disabled={listingId === undefined || briefingAngle === copy.angle}
                        onClick={() => void briefKai(copy)}
                        className={styles.briefButton}
                      >
                        {briefingAngle === copy.angle
                          ? "Membuat brief..."
                          : "Brief Kai untuk angle ini ✦"}
                      </button>
                      {listingId === undefined ? (
                        <p className={styles.briefNote}>
                          Tidak bisa menentukan listing untuk campaign ini secara otomatis — buat
                          brief manual di halaman Listing.
                        </p>
                      ) : null}
                      {briefResults[copy.angle] !== undefined ? (
                        <p className={styles.briefResultNote}>{briefResults[copy.angle]}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {activeTab === "abtest" ? (
          <div
            data-testid="settings-tab-panel-abtest"
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            {r.creativeRecommendations.abTestMatrix.length === 0 ? (
              <p className={styles.note}>
                Belum ada rekomendasi A/B test dari Samantha untuk campaign ini.
              </p>
            ) : (
              r.creativeRecommendations.abTestMatrix.map((test, i) => (
                <div key={i} className={styles.abTestCard}>
                  <div className={styles.abTestHeader}>
                    <span className={styles.abTestNumber}>Test {i + 1}</span>
                    <span className={styles.abTestName}>{test.test}</span>
                  </div>
                  <div className={styles.abTestVariants}>
                    <div className={styles.abTestVariantA}>
                      <div className={`${styles.abTestVariantLabel} ${styles.abTestVariantLabelA}`}>
                        Variant A
                      </div>
                      <div className={styles.abTestVariantValue}>
                        {ANGLE_LABEL[test.variantAAngle] ?? test.variantAAngle}
                      </div>
                    </div>
                    <div className={styles.abTestVariantB}>
                      <div className={`${styles.abTestVariantLabel} ${styles.abTestVariantLabelB}`}>
                        Variant B
                      </div>
                      <div className={styles.abTestVariantValue}>
                        {ANGLE_LABEL[test.variantBAngle] ?? test.variantBAngle}
                      </div>
                    </div>
                  </div>
                  <div className={styles.abTestFooter}>
                    <p className={styles.abTestHypothesis}>Hipotesis: {test.hypothesis}</p>
                    <div className={styles.abTestTags}>
                      <span className={`${styles.abTestTag} ${styles.abTestTagMetric}`}>
                        Metric: {test.metric}
                      </span>
                      <span className={`${styles.abTestTag} ${styles.abTestTagWinner}`}>
                        Winner: {test.winnerCriteria}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export interface MetaSettingsPanelUnavailableProps {
  readonly message: string;
}

/** Honest degrade for `available: false` — never a fabricated recommendation. */
export function MetaSettingsPanelUnavailable({
  message,
}: MetaSettingsPanelUnavailableProps): React.ReactElement {
  return (
    <p className={styles.unavailable} data-testid="settings-unavailable">
      Rekomendasi belum tersedia, coba lagi nanti. ({message})
    </p>
  );
}

export default MetaSettingsPanel;
