import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { CrmSidebar } from "@/components/layout/CrmSidebar";
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

/**
 * Root layout — Inter font + mobile bottom nav + desktop sidebar (spec "app/layout.tsx", extended
 * by AAOS-SALES-MGMT-CRM-AUTH with a real desktop sidebar — this app was mobile-only before this
 * task). `CrmSidebar`/`MobileNav` both render on every route including `/login` (harmless, same
 * precedent `MobileNav` already established: `/login` has no nav links a logged-out user shouldn't
 * reach, and `middleware.ts` is the actual auth gate — `CrmSidebar` itself renders a harmless
 * "Sales Human" placeholder when `useSalesSession()` has no session yet).
 */
export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="id" className={inter.variable}>
      <body className="min-h-screen bg-surface-page pb-16 font-sans text-ink antialiased md:pb-0">
        <div className="flex min-h-screen md:h-screen md:overflow-hidden">
          <CrmSidebar />
          <main className="min-w-0 flex-1 md:h-screen md:overflow-y-auto">{children}</main>
        </div>
        <MobileNav />
      </body>
    </html>
  );
}
