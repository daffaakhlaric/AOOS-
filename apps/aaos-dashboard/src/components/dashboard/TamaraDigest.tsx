"use client";

import { useState } from "react";

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
    <section
      data-testid="tamara-digest"
      className="rounded-card border border-hairline bg-surface-card p-4 shadow-card"
    >
      <p className="text-sm font-semibold text-ink">💬 Tamara Daily Digest</p>
      <p className="mt-1 text-sm text-ink-muted">{shown}</p>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-1 text-sm font-medium text-brand-primary"
        >
          {expanded ? "Sembunyikan" : "Lihat selengkapnya"}
        </button>
      ) : null}
    </section>
  );
}
