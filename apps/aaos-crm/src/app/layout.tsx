import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { MobileNav } from "@/components/ui/MobileNav";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "AAOS CRM",
  description:
    "Sales dashboard untuk tim Mobix DSS Motor — claim hot leads, follow up, input closing/SPK.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0A84FF",
  width: "device-width",
  initialScale: 1,
};

/** Root layout — Inter font + mobile bottom nav (spec "app/layout.tsx"). `MobileNav` renders on every route including `/login` (harmless — `/login` has no nav links a logged-out user shouldn't reach, and `middleware.ts` is the actual auth gate). */
export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="id" className={inter.variable}>
      <body className="min-h-screen bg-surface-page pb-16 font-sans text-ink antialiased">
        {children}
        <MobileNav />
      </body>
    </html>
  );
}
