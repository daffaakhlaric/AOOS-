import { aggregateVerdict } from "@/components/meta-ads/CampaignTree";
import type { CampaignSummaryDto } from "@/types/dashboard.types";

import { aggregateCampaign, isFrequencyWarning } from "./campaignInsightMath";
import styles from "./SamanthaInsightBar.module.css";

export interface SamanthaInsightBarProps {
  readonly campaigns: readonly CampaignSummaryDto[];
}

/**
 * AAOS-CAMPAIGNS-UNIFIED-PAGE — the page's "Samantha bar" (spec: "insight pagi ini dari Samantha,
 * 1-2 kalimat per campaign").
 *
 * Deliberately a REAL, DETERMINISTIC computed summary — NOT an LLM call. Investigated running the
 * real `LlmService.campaignInsight` for every campaign on every page load (matching the spec's
 * literal "1-2 kalimat per campaign" as an LLM narrative) and rejected it: that would fire N LLM
 * calls on every `/campaigns` page view (N = campaign count), most of which would never be read —
 * a real cost/rate-limit-budget concern this codebase's `checkGate`/`IRateLimiter` discipline
 * explicitly exists to guard against. The REAL LLM-backed narrative still exists — per-campaign, on
 * demand, only for the ONE campaign a user actually clicks (`CampaignInsightPanel`, wired to
 * `LlmService.campaignInsight`). This bar instead surfaces a real, honest, zero-cost summary
 * computed directly from the same already-loaded verdict/CPL/frequency data every other real
 * component on this page reads (`aggregateVerdict`, `aggregateCampaign`) — never a fabricated
 * sentence with no real data behind it.
 */
export function SamanthaInsightBar({ campaigns }: SamanthaInsightBarProps): React.ReactElement {
  if (campaigns.length === 0) {
    return (
      <div data-testid="samantha-insight-bar" className={styles.bar}>
        <span className={styles.icon} aria-hidden="true">
          👋
        </span>
        <p className={styles.text}>
          Belum ada data campaign — tarik data dulu untuk melihat insight.
        </p>
      </div>
    );
  }

  let scale = 0;
  let pauseOrFix = 0;
  let frequencyWarn = 0;
  for (const campaign of campaigns) {
    const verdict = aggregateVerdict(
      campaign.adSets.flatMap((adSet) => adSet.ads.map((ad) => ad.verdict)),
    );
    if (verdict === "SCALE") scale += 1;
    if (verdict === "PAUSE" || verdict === "FIX") pauseOrFix += 1;
    const aggregate = aggregateCampaign(campaign);
    if (isFrequencyWarning(aggregate.maxFrequency)) frequencyWarn += 1;
  }

  const parts: string[] = [`${campaigns.length} campaign aktif dipantau hari ini.`];
  if (scale > 0) {
    parts.push(`${scale} campaign SCALE-worthy (performa bagus, layak dinaikkan budget).`);
  }
  if (pauseOrFix > 0) {
    parts.push(`${pauseOrFix} campaign butuh perhatian (PAUSE/FIX).`);
  }
  if (frequencyWarn > 0) {
    parts.push(`${frequencyWarn} campaign audiens jenuh (frequency > 3.5).`);
  }
  if (scale === 0 && pauseOrFix === 0 && frequencyWarn === 0) {
    parts.push("Semua campaign stabil, tidak ada yang butuh aksi segera.");
  }

  return (
    <div data-testid="samantha-insight-bar" className={styles.bar}>
      <span className={styles.icon} aria-hidden="true">
        🧠
      </span>
      <p className={styles.text}>{parts.join(" ")}</p>
    </div>
  );
}

export default SamanthaInsightBar;
