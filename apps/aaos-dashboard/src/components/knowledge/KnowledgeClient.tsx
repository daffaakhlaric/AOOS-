"use client";

import { useState } from "react";

import { ExcelUploader } from "@/components/knowledge/ExcelUploader";
import {
  KnowledgeBaseList,
  type KnowledgeDocEntry,
} from "@/components/knowledge/KnowledgeBaseList";

import styles from "./KnowledgeClient.module.css";

const SEED_DOCS: readonly KnowledgeDocEntry[] = [
  { name: "SOP-Penjualan-v2.xlsx", itemCount: 48, uploadedAt: "2026-08-01T00:00:00.000Z" },
  { name: "FAQ-Kredit-Agustus.xlsx", itemCount: 23, uploadedAt: "2026-08-05T00:00:00.000Z" },
  { name: "Promo-Agustus-2026.xlsx", itemCount: 12, uploadedAt: "2026-08-07T00:00:00.000Z" },
];

/**
 * Excel upload + knowledge base list (spec "knowledge/page.tsx"). No `aaos-api` endpoint backs a
 * real upload/publish flow yet (not one of AAOS-W4A's 7 new endpoints — see `README.md`'s "Known
 * limitations"), so newly-dropped files are appended to local component state only, seeded with
 * the spec mockup's 3 example documents so the page has real, renderable content out of the box.
 */
export function KnowledgeClient(): React.ReactElement {
  const [docs, setDocs] = useState<readonly KnowledgeDocEntry[]>(SEED_DOCS);

  function handleFileSelected(file: File): void {
    setDocs((current) => [
      { name: file.name, itemCount: 0, uploadedAt: new Date().toISOString() },
      ...current,
    ]);
  }

  return (
    <div className={styles.page}>
      <div>
        <h2 className={styles.title}>📚 Knowledge Base</h2>
        <p className={styles.subtitle}>Upload SOP, FAQ, promo, kredit untuk Jessy</p>
      </div>
      <ExcelUploader onFileSelected={handleFileSelected} />
      <div>
        <h3 className={styles.sectionTitle}>Knowledge yang aktif</h3>
        <KnowledgeBaseList docs={docs} />
      </div>
    </div>
  );
}
