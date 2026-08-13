import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "AAOS Dashboard",
  description:
    "Dashboard manajemen DSS Motor — Meta Ads, Objective, Creative Review, Branch Settings.",
};

/** Root layout — Inter font + sidebar (spec "app/layout.tsx"). `Sidebar`/`MobileNav` render on every route including `/login` (harmless — `/login` itself has no nav links pointing at protected pages a logged-out user shouldn't reach, and `middleware.ts` is the actual auth gate). */
export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="id" className={inter.variable}>
      <body className="min-h-screen bg-surface-page font-sans text-ink antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 pb-16 md:pb-0">{children}</div>
        </div>
        <MobileNav />
      </body>
    </html>
  );
}
