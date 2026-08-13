import { formatNumber } from "@/lib/formatters";
import type { AdMetricsDto } from "@/types/dashboard.types";

/** Mini funnel: Chat → D2 → D3 → D5 → Form (spec "components/meta-ads/CampaignFunnelBar.tsx"). */
export function CampaignFunnelBar({
  metrics,
}: {
  readonly metrics: AdMetricsDto;
}): React.ReactElement {
  const steps: ReadonlyArray<readonly [string, number]> = [
    ["Chat", metrics.conversations],
    ["D2", metrics.d2],
    ["D3", metrics.d3],
    ["D5", metrics.d5],
    ["Form", metrics.leadForm],
  ];
  return (
    <div data-testid="campaign-funnel-bar" className="flex items-center gap-2 text-xs">
      {steps.map(([label, value], index) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-ink-muted">
            {label} <span className="font-semibold text-ink">{formatNumber(value)}</span>
          </span>
          {index < steps.length - 1 ? <span aria-hidden="true">→</span> : null}
        </div>
      ))}
    </div>
  );
}
