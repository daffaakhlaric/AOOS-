import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";

const VERDICT_TONE: Readonly<Record<string, StatusTone>> = {
  SCALE: "success",
  KEEP: "success",
  REVIEW: "warning",
  PAUSE: "danger",
  REFRESH: "warning",
  FIX: "danger",
};

/** Colored badge for a Meta Ads verdict — SCALE/KEEP/REVIEW/PAUSE/REFRESH/FIX (spec "components/meta-ads/VerdictBadge.tsx"). */
export function VerdictBadge({ verdict }: { readonly verdict: string }): React.ReactElement {
  return <StatusBadge label={verdict} tone={VERDICT_TONE[verdict] ?? "neutral"} />;
}
