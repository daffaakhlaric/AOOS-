/**
 * Colored badge for a Meta Ads verdict — SCALE/KEEP/PAUSE/REVIEW/FIX/REFRESH/CUT (spec
 * "components/meta-ads/VerdictBadge.tsx"; UI-overhaul pass: "=== VERDICT BADGES ===" — small
 * rounded rectangle (5px radius), an icon glyph + uppercase label per verdict, exact
 * bg/text/border hex per verdict, 10px/600-weight/tracking-wide text, 3px/7px padding).
 *
 * Deliberately does NOT reuse `@/components/ui/StatusBadge` here: that component's `StatusTone`
 * union (`success`/`warning`/`danger`/`neutral`) only maps to 4 colors, which would collapse
 * several of these verdicts onto the same tone — losing the distinction the spec asks for (most
 * strikingly, REVIEW and FIX are INTENTIONALLY the same amber per the spec's own hex table, while
 * PAUSE and CUT are intentionally the same red — this badge differentiates them by icon + label
 * text, not by inventing extra colors that aren't in the spec). `StatusBadge` is a shared
 * primitive other badges (sales status, branch-active) also render through, so widening its shared
 * tone palette to fit this one badge's needs risked unintended effects elsewhere; a small local
 * color map here (started in the MAAO2 redesign, extended in this UI-overhaul pass) is safer and
 * just as simple. The exact hex values below are intentionally NOT promoted to shared
 * `tailwind.config.ts` tokens — see that file's own docstring for why.
 *
 * `CUT` is not a value of the real `packages/meta-ads-connector` `Verdict` enum (SCALE/KEEP/
 * REVIEW/REFRESH/FIX/PAUSE) — it is `AnalisaClient.tsx`'s own client-side per-BRANCH aggregate
 * verdict concept (a different, already-established judgment call, not the per-ad `VerdictEngine`
 * output). It is included here purely so `AnalisaClient`'s branch-verdict table can render through
 * this same shared badge component/color-map pattern instead of duplicating one locally.
 */
interface VerdictStyle {
  readonly className: string;
  readonly icon: string;
}

const VERDICT_STYLES: Readonly<Record<string, VerdictStyle>> = {
  SCALE: { className: "bg-[#E8FAF0] text-[#1A9E5C] border-[#B3EDD0]", icon: "↑" },
  KEEP: { className: "bg-[#EEF4FF] text-[#2563EB] border-[#BFDBFE]", icon: "●" },
  REVIEW: { className: "bg-[#FFF8ED] text-[#D97706] border-[#FDE68A]", icon: "◐" },
  PAUSE: { className: "bg-[#FFF1F1] text-[#DC2626] border-[#FECACA]", icon: "⏸" },
  FIX: { className: "bg-[#FFF8ED] text-[#D97706] border-[#FDE68A]", icon: "⚠" },
  CUT: { className: "bg-[#FFF1F1] text-[#DC2626] border-[#FECACA]", icon: "✕" },
  // Not in the spec's badge table (a real `VerdictEngine` output the mockups don't happen to
  // depict) — kept visually distinct (purple) from every spec-defined color above.
  REFRESH: { className: "bg-purple-50 text-purple-700 border-purple-300", icon: "↻" },
};
const UNKNOWN_VERDICT_STYLE: VerdictStyle = {
  className: "bg-ink-muted/10 text-ink-muted border-ink-muted/30",
  icon: "?",
};

export function VerdictBadge({ verdict }: { readonly verdict: string }): React.ReactElement {
  const style = VERDICT_STYLES[verdict] ?? UNKNOWN_VERDICT_STYLE;
  return (
    <span
      data-testid="verdict-badge"
      className={`inline-flex items-center gap-1 rounded-[5px] border px-[7px] py-[3px] text-[10px] font-semibold uppercase tracking-wide ${style.className}`}
    >
      <span aria-hidden="true">{style.icon}</span>
      <span>{verdict}</span>
    </span>
  );
}
