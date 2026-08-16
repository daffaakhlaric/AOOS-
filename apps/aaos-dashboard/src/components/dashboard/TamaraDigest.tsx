"use client";

import { useState } from "react";

import styles from "./TamaraDigest.module.css";

const TRUNCATE_LENGTH = 80;

export interface TamaraDigestProps {
  readonly text: string;
}

/**
 * Latest Tamara daily digest (spec "dashboard/page.tsx" mockup: "Hari ini pause 3 iklan boros
 * (hemat Rp 1.2jt)..." + "[Lihat selengkapnya]"). No `aaos-api` endpoint backs a "daily digest"
 * yet (not one of AAOS-W4A's 7 new endpoints) — this renders whatever `text` its caller supplies;
 * `dashboard/page.tsx` currently passes a static placeholder string, documented in that file.
 */
export function TamaraDigest({ text }: TamaraDigestProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > TRUNCATE_LENGTH;
  const shown = expanded || !isLong ? text : `${text.slice(0, TRUNCATE_LENGTH)}...`;

  return (
    <section data-testid="tamara-digest" className={styles.section}>
      <p className={styles.title}>💬 Tamara Daily Digest</p>
      <p className={styles.text}>{shown}</p>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className={styles.toggle}
        >
          {expanded ? "Sembunyikan" : "Lihat selengkapnya"}
        </button>
      ) : null}
    </section>
  );
}
