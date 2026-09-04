import colors from "tailwindcss/colors";
import type { Config } from "tailwindcss";

/**
 * TREMOR REBUILD ADDITIONS (this task): `@tremor/react@3.18.7` (the real version this task
 * installed — verified via `node_modules/@tremor/react/package.json`) ships NO prebuilt CSS file
 * at all — there is no `dist/esm/tremor.css` for `src/app/layout.tsx` to import, unlike what the
 * spec's STEP 1 assumes. Tremor v3 components are plain Tailwind-utility-class markup (e.g.
 * `className="tremor-Table-root w-full ..."`) with zero own styling — every visual property comes
 * from Tailwind actually generating CSS for those class names at build time. Since this app's own
 * `globals.css` dropped its `@tailwind base/components/utilities` directives in the prior CSS
 * Modules migration, Tailwind currently generates nothing, so Tremor components would render
 * completely unstyled (no borders, spacing, or color) without three real, verified additions:
 *   1. `content` below now also scans `./node_modules/@tremor/react/**\/*.{js,ts,jsx,tsx}` so
 *      Tailwind's JIT compiler can see the literal utility-class strings inside Tremor's own
 *      compiled components (it cannot generate CSS for a class name it never scans).
 *   2. `theme.extend.colors.tremor`/`"dark-tremor"` and the `boxShadow`/`borderRadius`/`fontSize`
 *      "tremor-*" tokens below are Tremor's own documented, required theme extension (tremor's
 *      components reference `bg-tremor-brand`, `shadow-tremor-card`, etc. — undefined utility
 *      names otherwise). `brand.DEFAULT`/`emphasis` are retuned from Tremor's stock blue to this
 *      app's own `--blue`/`--blue-light` (`#0070F3`/`#EEF4FF` — see `globals.css`) specifically so
 *      Tremor's Table/Badge/Card/Metric components read as the SAME blue as the rest of the
 *      hand-crafted CSS Modules design system, not a visually-clashing second blue.
 *   3. `safelist` (Tremor's own documented pattern) covers the dynamically-composed
 *      `bg-emerald-100 text-emerald-800`-style classes `Badge color="..."` / `BadgeDelta` build
 *      from a runtime `color` prop — Tailwind's static scanner can't see those from Tremor's
 *      source alone.
 * `corePlugins.preflight: false`: Tailwind's own base reset (`@tailwind base`) duplicates and
 * would fight with `globals.css`'s already-hand-written `* { box-sizing; margin; padding }` reset
 * and default typography — disabling Tailwind's preflight keeps ONLY its utility-class generation
 * active, so re-enabling Tailwind for Tremor's sake cannot silently change how any existing
 * CSS-Modules-styled element (button/input/heading defaults, etc.) renders elsewhere in the app.
 */

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
  content: ["./src/**/*.{ts,tsx}", "./node_modules/@tremor/react/**/*.{js,ts,jsx,tsx}"],
  corePlugins: {
    preflight: false,
  },
  safelist: [
    {
      pattern:
        /^(bg|text|border|ring|fill|stroke)-(?:tremor|dark-tremor)-(?:brand|background|border|ring|content)(?:-\w+)?$/,
      variants: ["hover", "ui-selected"],
    },
  ],
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
        // Tremor's own required theme extension (see this file's top docstring), retuned to this
        // app's real `--blue`/`--blue-light`/`--gray-*` tokens from `globals.css` instead of
        // Tremor's stock blue/slate, so Tremor components read as one palette with the rest of
        // the app rather than a visually-clashing second design system.
        tremor: {
          brand: {
            faint: "#EEF4FF", // var(--blue-light)
            muted: colors.blue[200],
            subtle: colors.blue[400],
            DEFAULT: "#0070F3", // var(--blue)
            emphasis: "#0058C7",
            inverted: colors.white,
          },
          background: {
            muted: "#FAFAFA", // var(--gray-100)
            subtle: "#EAEAEA", // var(--gray-200)
            DEFAULT: colors.white,
            emphasis: colors.gray[700],
          },
          border: { DEFAULT: "#EAEAEA" }, // var(--gray-200)
          ring: { DEFAULT: "#EAEAEA" },
          content: {
            subtle: colors.gray[400],
            DEFAULT: "#666666", // var(--gray-500)
            emphasis: "#333333", // var(--gray-700)
            strong: "#111111", // var(--gray-900)
            inverted: colors.white,
          },
        },
        "dark-tremor": {
          brand: {
            faint: colors.blue[900],
            muted: colors.blue[800],
            subtle: colors.blue[600],
            DEFAULT: colors.blue[500],
            emphasis: colors.blue[400],
            inverted: colors.blue[950],
          },
          background: {
            muted: colors.gray[950],
            subtle: colors.gray[800],
            DEFAULT: colors.gray[900],
            emphasis: colors.gray[300],
          },
          border: { DEFAULT: colors.gray[700] },
          ring: { DEFAULT: colors.gray[700] },
          content: {
            subtle: colors.gray[600],
            DEFAULT: colors.gray[500],
            emphasis: colors.gray[200],
            strong: colors.gray[50],
            inverted: colors.gray[950],
          },
        },
      },
      borderRadius: {
        card: "10px",
        kpi: "12px",
        button: "7px",
        "tremor-small": "0.375rem",
        "tremor-default": "0.5rem",
        "tremor-full": "9999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04)",
        "tremor-input": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "tremor-card": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "tremor-dropdown": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      },
      fontSize: {
        "tremor-label": "0.75rem",
        "tremor-default": ["0.875rem", { lineHeight: "1.25rem" }],
        "tremor-title": ["1.125rem", { lineHeight: "1.75rem" }],
        "tremor-metric": ["1.875rem", { lineHeight: "2.25rem" }],
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
