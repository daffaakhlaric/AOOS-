import type { Config } from "tailwindcss";

/**
 * Apple/Notion design tokens — reused VERBATIM from `apps/aaos-dashboard/tailwind.config.ts`
 * (itself reused verbatim from `apps/aaos-simulator`), per this spec's own instruction to reuse
 * the sibling app's established Tailwind theme rather than reinvent it.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          page: "#F2F2F7",
          card: "#FFFFFF",
        },
        brand: {
          primary: "#0A84FF",
          success: "#30D158",
          warning: "#FF9F0A",
          danger: "#FF3B30",
        },
        ink: {
          DEFAULT: "#1C1C1E",
          muted: "#8E8E93",
        },
        hairline: "#E5E5EA",
      },
      borderRadius: {
        card: "12px",
        button: "8px",
      },
      boxShadow: {
        card: "0 2px 8px rgba(0,0,0,0.08)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
