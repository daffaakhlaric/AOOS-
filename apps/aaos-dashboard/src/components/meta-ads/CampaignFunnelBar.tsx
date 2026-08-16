import { formatNumber } from "@/lib/formatters";
import type { AdMetricsDto } from "@/types/dashboard.types";

import styles from "./CampaignFunnelBar.module.css";

/**
 * Mini funnel: Klik → Chat → D2 → D3 → D5 → Form (spec "components/meta-ads/CampaignFunnelBar.tsx";
 * MAAO2 redesign mockup additionally lists a "WA" stage between Klik and Chat — dropped here since
 * `aaos-api`'s real per-ad metrics (`AdMetricsResponseDto`) have no field distinct from
 * `conversations`/Chat for it; inventing one would just duplicate Chat's number under a different
 * label). TOTAL UI REBUILD spec "=== AD LEVEL (#C001) === Funnel row": 0 renders gray-300, D3/Chat
 * (the "is D3/Lead" step per the spec) render blue when > 0.
 */
export function CampaignFunnelBar({
  metrics,
}: {
  readonly metrics: AdMetricsDto;
}): React.ReactElement {
  const steps: ReadonlyArray<{ label: string; value: number; highlight?: boolean }> = [
    { label: "Klik", value: metrics.clicks },
    { label: "Chat", value: metrics.conversations },
    { label: "D2", value: metrics.d2 },
    { label: "D3", value: metrics.d3, highlight: true },
    { label: "D5", value: metrics.d5 },
    { label: "Form", value: metrics.leadForm },
  ];
  return (
    <div data-testid="campaign-funnel-bar" className={styles.row}>
      {steps.map((step, index) => {
        const numberClass =
          step.value === 0
            ? styles.numberZero
            : step.highlight === true
              ? styles.numberHighlight
              : "";
        return (
          <div key={step.label} className={styles.step}>
            <span className={styles.label}>{step.label}</span>
            <span className={`${styles.number} ${numberClass}`}>{formatNumber(step.value)}</span>
            {index < steps.length - 1 ? (
              <span aria-hidden="true" className={styles.arrow}>
                →
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
