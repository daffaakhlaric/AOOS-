import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "AAOS Dashboard",
  description:
    "Dashboard manajemen DSS Motor — Meta Ads, Objective, Creative Review, Branch Settings.",
};

/**
 * Root layout — Inter font + shared `<html>`/`<body>` shell only (spec "app/layout.tsx").
 * `Sidebar`/`MobileNav` moved to `(app)/layout.tsx` (a sibling route group) so they render only
 * for the authenticated app routes, not `(auth)/login` — the login page is a bare centered form.
 */
export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="id" className={inter.variable}>
      <body className="min-h-screen bg-surface-page font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
