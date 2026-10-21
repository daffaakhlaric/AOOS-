import colors from "tailwindcss/colors";
import type { Config } from "tailwindcss";

/**
 * Tailwind here exists SOLELY to generate the utility-class CSS @tremor/react's components need at
 * runtime (Tremor v3 ships no prebuilt CSS — see src/app/tremor.css's own doc) — every other
 * component in this app uses CSS Modules, per this app's own build brief ("CSS Modules throughout,
 * NOT Tailwind utility classes in practice"). `corePlugins.preflight: false` keeps Tailwind's base
 * reset from fighting with globals.css's own hand-written reset. Tremor's required "tremor-*"
 * theme tokens are retuned to this app's own `--brand`/`--border` design tokens (#6941C6/#E4E7EC)
 * so Tremor's LineChart reads as one palette with the rest of the hand-crafted design system.
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
    { pattern: /^(bg|text|border|ring|fill|stroke)-(cyan|emerald|amber)-\d+$/ },
  ],
  theme: {
    extend: {
      colors: {
        tremor: {
          brand: {
            faint: "var(--brand-soft)",
            muted: "var(--brand)",
            subtle: "var(--brand)",
            DEFAULT: "var(--brand)",
            emphasis: "var(--brand-hover)",
            inverted: colors.white,
          },
          background: {
            muted: "var(--bg)",
            subtle: "var(--border)",
            DEFAULT: colors.white,
            emphasis: colors.gray[700],
          },
          border: { DEFAULT: "var(--border)" },
          ring: { DEFAULT: "var(--border)" },
          content: {
            subtle: colors.gray[400],
            DEFAULT: "var(--text-secondary)",
            emphasis: "var(--text-secondary)",
            strong: "var(--text-primary)",
            inverted: colors.white,
          },
        },
        "dark-tremor": {
          brand: {
            faint: "var(--brand)",
            muted: "var(--brand)",
            subtle: "var(--brand)",
            DEFAULT: "var(--brand)",
            emphasis: "var(--brand)",
            inverted: "var(--brand)",
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
        "tremor-small": "0.375rem",
        "tremor-default": "0.5rem",
        "tremor-full": "9999px",
      },
      boxShadow: {
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
    },
  },
  plugins: [],
};

export default config;
