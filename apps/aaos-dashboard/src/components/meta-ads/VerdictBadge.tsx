/**
 * Colored badge for a Meta Ads verdict — SCALE/KEEP/PAUSE/REVIEW/FIX/REFRESH (spec
 * "components/meta-ads/VerdictBadge.tsx", MAAO2 redesign: 6 visually distinct colors —
 * SCALE=green, KEEP=blue, PAUSE=red, REVIEW=orange, FIX=yellow, REFRESH=purple).
 *
 * Deliberately does NOT reuse `@/components/ui/StatusBadge` here: that component's `StatusTone`
 * union (`success`/`warning`/`danger`/`neutral`) only maps to 4 colors, which collapses SCALE/KEEP
 * into the same green and PAUSE/FIX into the same red — losing the distinction the mockup asks
 * for. `StatusBadge` is a shared primitive other badges (sales status, branch-active) also render
 * through, so widening its shared tone palette to fit this one badge's needs risked unintended
 * effects elsewhere; a small local color map here is safer and just as simple.
 */
const VERDICT_CLASSES: Readonly<Record<string, string>> = {
  SCALE: "bg-green-50 text-green-700 border-green-300",
  KEEP: "bg-blue-50 text-blue-700 border-blue-300",
  PAUSE: "bg-red-50 text-red-700 border-red-300",
  REVIEW: "bg-orange-50 text-orange-700 border-orange-300",
  FIX: "bg-yellow-50 text-yellow-800 border-yellow-300",
  REFRESH: "bg-purple-50 text-purple-700 border-purple-300",
};
const UNKNOWN_VERDICT_CLASSES = "bg-ink-muted/10 text-ink-muted border-ink-muted/30";

export function VerdictBadge({ verdict }: { readonly verdict: string }): React.ReactElement {
  return (
    <span
      data-testid="verdict-badge"
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${VERDICT_CLASSES[verdict] ?? UNKNOWN_VERDICT_CLASSES}`}
    >
      {verdict}
    </span>
  );
}
