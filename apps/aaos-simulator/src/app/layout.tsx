import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "AAOS Jessy Simulator",
  description: "Test kualitas Jessy sebelum deploy ke WhatsApp — internal tool for DSS Motor.",
};

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
