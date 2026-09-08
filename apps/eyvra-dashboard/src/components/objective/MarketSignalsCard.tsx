"use client";

import { useEffect, useState } from "react";

import type { MarketSignalsDto } from "@/types/market-signals.types";

import styles from "./MarketSignalsCard.module.css";

/** "diperbarui 3 hari lalu" per the spec's own exact wording — a day-granularity relative-time formatter kept local to this component (the shared `formatRelativeTimeId` in `lib/formatters.ts` falls back to a plain date past 24h, a different real UX choice for a different real use case). */
function formatUpdatedAgo(iso: string, now: Date = new Date()): string {
  const deltaMs = now.getTime() - new Date(iso).getTime();
  const days = Math.floor(deltaMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return "diperbarui hari ini";
  if (days === 1) return "diperbarui 1 hari lalu";
  return `diperbarui ${String(days)} hari lalu`;
}

interface SignalRow {
  readonly key: string;
  readonly tag: string;
  readonly text: string;
  readonly available: boolean;
}

function buildRows(signals: MarketSignalsDto): readonly SignalRow[] {
  const rows: SignalRow[] = [];

  if (signals.searchTrend.available) {
    const rising = signals.searchTrend.keywords.filter((k) => k.trend === "RISING");
    const summary =
      rising.length > 0
        ? rising.map((k) => `"${k.keyword}" ${k.delta}`).join(", ")
        : signals.searchTrend.keywords.map((k) => `"${k.keyword}" ${k.delta}`).join(", ") ||
          "Tidak ada data keyword.";
    rows.push({ key: "search", tag: "Search", text: summary, available: true });
  } else {
    rows.push({
      key: "search",
      tag: "Search",
      text: `Belum tersedia — ${signals.searchTrend.reason}`,
      available: false,
    });
  }

  if (signals.competitorAngleTrend.available) {
    const entries = Object.entries(signals.competitorAngleTrend.angleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([angle, count]) => `${angle} (${String(count)})`)
      .join(", ");
    rows.push({
      key: "competitor",
      tag: "Kompetitor",
      text:
        entries.length > 0
          ? `Angle terbanyak dipakai kompetitor: ${entries}`
          : signals.competitorAngleTrend.reasoning,
      available: true,
    });
  } else {
    rows.push({
      key: "competitor",
      tag: "Kompetitor",
      text: `Belum tersedia — ${signals.competitorAngleTrend.reason}`,
      available: false,
    });
  }

  if (signals.kprRate.available) {
    rows.push({
      key: "kpr",
      tag: "KPR Rate",
      text: `Rate KPR/BI saat ini ${String(signals.kprRate.currentPct)}% (${signals.kprRate.direction.toLowerCase()})`,
      available: true,
    });
  } else {
    rows.push({
      key: "kpr",
      tag: "KPR Rate",
      text: `Belum tersedia — ${signals.kprRate.reason}`,
      available: false,
    });
  }

  rows.push({
    key: "seasonal",
    tag: "Musiman",
    text: signals.seasonality.note,
    available: true,
  });

  return rows;
}

/**
 * AAOS LOOP UPGRADE, Sprint 7 Prompt 18 ("Market Intelligence") — "Sinyal Pasar" card. REAL
 * CURRENT LOCATION: the spec's own literal wording says "di /property/campaigns Tab Objective, di
 * bawah Card Konteks Bisnis" — that tab no longer exists after the `/campaigns` unified-page
 * rebuild (`b9e7b2a`). Investigated the REAL current home of "Konteks Bisnis" (Sprint 6 Prompt 15):
 * it lives on `PropertyObjectiveForm.tsx` (rendered by `/objective`'s `ObjectiveClient.tsx`), NOT
 * on the unified `/campaigns` page (whose own "Objective" section is `ObjectiveStripCard.tsx`, a
 * genuinely different, narrower real card with no Konteks Bisnis of its own). This card is placed
 * directly below the real Konteks Bisnis section in `PropertyObjectiveForm.tsx` — the real,
 * current analog of the spec's own "di bawah Card Konteks Bisnis" placement instruction.
 *
 * PROPERTY-only, same real reason `PropertyObjectiveForm.tsx` itself is PROPERTY-only.
 */
export function MarketSignalsCard(): React.ReactElement | null {
  const [signals, setSignals] = useState<MarketSignalsDto | null | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/market-signals/latest")
      .then(async (res) => {
        if (!res.ok) throw new Error("Gagal memuat sinyal pasar.");
        return (await res.json()) as { signals: MarketSignalsDto | null };
      })
      .then((body) => {
        if (!cancelled) setSignals(body.signals);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat sinyal pasar.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (signals === undefined && error === undefined) {
    // Still loading — render nothing rather than a flashing skeleton, same "quiet while loading"
    // choice several other small strip cards on this real page already make.
    return null;
  }

  if (error !== undefined) {
    return (
      <section
        className={styles.section}
        data-testid="market-signals-card"
        aria-label="Sinyal Pasar"
      >
        <h3 className={styles.title}>📊 Sinyal Pasar</h3>
        <p className={styles.empty}>{error}</p>
      </section>
    );
  }

  if (signals === undefined) {
    // Unreachable in practice (the `error === undefined` branch above already returned when
    // still loading), but narrows the type honestly for TypeScript rather than a non-null
    // assertion.
    return null;
  }

  if (signals === null) {
    return (
      <section
        className={styles.section}
        data-testid="market-signals-card"
        aria-label="Sinyal Pasar"
      >
        <h3 className={styles.title}>📊 Sinyal Pasar</h3>
        <p className={styles.empty}>
          Belum ada data sinyal pasar — refresh mingguan pertama belum berjalan untuk tenant ini.
        </p>
      </section>
    );
  }

  const rows = buildRows(signals);

  return (
    <section className={styles.section} data-testid="market-signals-card" aria-label="Sinyal Pasar">
      <h3 className={styles.title}>📊 Sinyal Pasar</h3>
      <p className={styles.updatedAt} data-testid="market-signals-updated-at">
        {formatUpdatedAgo(signals.generatedAt)}
      </p>
      <ul className={styles.list}>
        {rows.map((row) => (
          <li key={row.key} className={styles.item}>
            <span className={styles.bullet}>•</span>
            <span className={styles.tag}>{row.tag}</span>
            <span className={`${styles.text} ${row.available ? "" : styles.unavailable}`}>
              {row.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default MarketSignalsCard;
