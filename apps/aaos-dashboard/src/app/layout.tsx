import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
/**
 * TOTAL UI REBUILD spec's `--mono: 'JetBrains Mono', 'Fira Code', monospace` (ID badges, funnel
 * numbers — `font-variant-numeric: tabular-nums` reads best in a real monospace). `next/font/
 * google` supports `JetBrains_Mono` directly (the spec's primary choice), so it's loaded the same
 * way `Inter` already is, exposed as `--font-mono` and consumed by `globals.css`'s `--mono`
 * custom property.
 */
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "AAOS Dashboard",
  description:
    "Dashboard manajemen DSS Motor — Meta Ads, Objective, Creative Review, Branch Settings.",
};

/**
 * Root layout — Inter + JetBrains Mono fonts + shared `<html>`/`<body>` shell only (spec
 * "app/layout.tsx"). `Sidebar`/`MobileNav` moved to `(app)/layout.tsx` (a sibling route group) so
 * they render only for the authenticated app routes, not `(auth)/login` — the login page is a
 * bare centered form. Body styling comes entirely from `globals.css`'s hand-crafted reset now
 * (TOTAL UI REBUILD) — no Tailwind utility classes here.
 */
export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="id" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
