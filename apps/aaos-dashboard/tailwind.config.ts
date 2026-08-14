import type { Config } from "tailwindcss";

/**
 * Design tokens for the premium-B2B-SaaS overhaul (Linear/Vercel/Apple-Settings inspired —
 * `docs/PROMPT-AAOS-DASHBOARD-UI-OVERHAUL.md`).
 *
 * IMPORTANT DEVIATION FROM PRIOR STATE: this file's tokens were previously "reused VERBATIM from
 * `apps/aaos-simulator/tailwind.config.ts`" for cross-app visual consistency. This overhaul's real
 * design direction (Linear/Vercel/Apple Settings) is deliberately NOT `aaos-simulator`'s current
 * look, so the values below have diverged from that file on purpose — `aaos-simulator` was left
 * untouched (out of this task's scope; changing this app's own copy does not touch it). If the two
 * apps are meant to look identical again, `aaos-simulator/tailwind.config.ts` needs the same values
 * applied as a follow-up; until then, treat the two token files as independent.
 *
 * Token-value diff vs. the pre-overhaul version (see `docs/AAOS-UI-OVERHAUL-REPORT.md` for the
 * full table): `surface.page` #F7F7F7 → #F5F5F7, `brand.danger` #FF3B30 → #FF453A (now matches the
 * spec's KPI-bar "bad value" red — general/non-badge danger use), `rounded.card` 12px → 10px,
 * `rounded.button` 8px → 7px, `shadow.card` heavier → subtler. `brand.success`/`brand.warning`/
 * `brand.primary`/`ink.*` are exact matches with the spec and are unchanged.
 *
 * New tokens added: `rounded.kpi` (12px — the KPI summary strip wants a different, larger radius
 * than cards) and `hairline.sidebar`/`hairline.card`/`hairline.subtle`/`hairline.table` (the spec
 * needs 4 visually-distinct hairline shades in 4 different contexts — sidebar right border, card/
 * KPI-bar border, card section-title underline, table row divider — so one `hairline` value can no
 * longer serve all of them; `hairline.DEFAULT` is untouched at #E5E5EA so every existing
 * `border-hairline` usage app-wide keeps rendering exactly as before unless deliberately migrated
 * to one of the new, more specific tokens).
 *
 * Deliberately NOT added as shared tokens: the spec's per-verdict-badge/destructive-button reds
 * (#DC2626 text on #FFF1F1/#FECACA) and REVIEW/FIX oranges (#D97706 on #FFF8ED/#FDE68A) — these are
 * local, component-scoped color maps (`VerdictBadge.tsx`'s existing pattern, extended; see that
 * file's docstring) rather than shared tokens, since `brand.danger`/`brand.warning` are genuinely
 * used elsewhere (KPI bad-value text, generic warnings) for a different, lighter-weight meaning
 * that a shared rename would incorrectly overwrite everywhere at once.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          page: "#F5F5F7",
          card: "#FFFFFF",
        },
        brand: {
          primary: "#0A84FF",
          success: "#30D158",
          warning: "#FF9F0A",
          danger: "#FF453A",
        },
        ink: {
          DEFAULT: "#1C1C1E",
          muted: "#8E8E93",
        },
        hairline: {
          DEFAULT: "#E5E5EA",
          sidebar: "#EBEBEB",
          card: "#E8E8ED",
          subtle: "#F2F2F7",
          table: "#F7F7F7",
        },
      },
      borderRadius: {
        card: "10px",
        kpi: "12px",
        button: "7px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
