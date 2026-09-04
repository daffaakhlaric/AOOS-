import styles from "./VerdictBadge.module.css";

/**
 * Colored badge for a Meta Ads verdict — SCALE/KEEP/PAUSE/REVIEW/FIX/REFRESH/CUT (TOTAL UI REBUILD
 * spec "=== CAMPAIGN CARDS === Verdict badge" — this spec's own table lists only the 5 real
 * `VerdictEngine` outputs it depicts in its mockups: SCALE/KEEP/REVIEW/PAUSE/FIX, each mapped to
 * one of this spec's exact `var(--green|blue|amber|red)` colors via `VerdictBadge.module.css`).
 *
 * `REFRESH` is a real `VerdictEngine` output (`packages/meta-ads-connector`'s `Verdict` enum:
 * SCALE/KEEP/REVIEW/REFRESH/FIX/PAUSE) that simply isn't depicted in this spec's mockups — kept
 * here rather than silently dropped, since the app can genuinely receive it from `aaos-api`.
 * This spec's `:root` block has no color left over for a 6th, visually-distinct verdict, so a new
 * `--purple`/`--purple-light` pair was added to `globals.css` for it (see that file's docstring;
 * same judgment call as the prior UI-overhaul pass, restated because it recurred).
 *
 * `CUT` is not a value of the real `Verdict` enum at all — it is `AnalisaClient.tsx`'s own
 * client-side per-BRANCH aggregate verdict concept (a different, already-established judgment
 * call). It intentionally reuses PAUSE's red (both mean "stop"), distinguished by icon + label
 * text rather than a 7th unique color, so `AnalisaClient`'s branch-verdict table can render
 * through this same shared badge component instead of duplicating a color map locally.
 */
interface VerdictStyle {
  readonly className: string;
  readonly icon: string;
}

/**
 * FIX intentionally reuses REVIEW's CSS-module class (not its own `.fix` selector) and CUT
 * intentionally reuses PAUSE's, so two verdicts the spec's own hex table gives IDENTICAL colors
 * also resolve to the exact same (hashed) class name at runtime — not just visually-identical-but-
 * distinct selectors. `.fix`/`.cut` remain defined in the `.module.css` file as documentation of
 * intent (and in case a future spec revision gives them a distinct color), but are unused here.
 */
// CSS Modules are typed as `{ readonly [key: string]: string }` by Next.js's ambient module
// declaration — with this repo's `noUncheckedIndexedAccess`, every `styles.xxx` access is typed
// `string | undefined` even though the key statically exists in the co-located `.module.css`
// file. `?? ""` below resolves that type-only gap; at runtime the value is always defined.
function stylesFor(styleModule: typeof styles): Readonly<Record<string, VerdictStyle>> {
  return {
    SCALE: { className: styleModule.scale ?? "", icon: "↑" },
    KEEP: { className: styleModule.keep ?? "", icon: "●" },
    REVIEW: { className: styleModule.review ?? "", icon: "◐" },
    PAUSE: { className: styleModule.pause ?? "", icon: "⏸" },
    FIX: { className: styleModule.review ?? "", icon: "⚠" },
    CUT: { className: styleModule.pause ?? "", icon: "✕" },
    REFRESH: { className: styleModule.refresh ?? "", icon: "↻" },
  };
}

export function VerdictBadge({ verdict }: { readonly verdict: string }): React.ReactElement {
  const verdictStyles = stylesFor(styles);
  const style = verdictStyles[verdict] ?? { className: styles.unknown ?? "", icon: "?" };
  return (
    <span
      data-testid="verdict-badge"
      data-verdict={verdict}
      className={`${styles.badge} ${style.className}`}
    >
      <span aria-hidden="true">{style.icon}</span>
      <span>{verdict}</span>
    </span>
  );
}
