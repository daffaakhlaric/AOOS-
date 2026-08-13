import type { Config } from "tailwindcss";

/**
 * Apple/Notion design tokens — reused VERBATIM from `apps/aaos-simulator/tailwind.config.ts`
 * (AAOS-W4A coordinator note #1: no screenshot exists this session; the spec's own ASCII
 * mockups plus this exact palette, already established by the simulator app, are the source of
 * truth for visual consistency across both apps).
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          page: "#F7F7F7",
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
