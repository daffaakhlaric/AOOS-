import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import "./globals.css";
// Imported after globals.css so this app's own hand-crafted tokens win any overlap — see
// tremor.css's own doc for why this exists at all (Tremor's LineChart needs Tailwind-generated
// utility-class CSS; every other component in this app stays CSS Modules).
import "./tremor.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "EYVRA",
  description: "EYVRA Command Center — an agentic advertising operations console.",
};

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
