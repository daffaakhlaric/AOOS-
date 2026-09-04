"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { CalendarWidget } from "@/components/calendar/CalendarWidget";
import { BranchSummary, type BranchSummaryRow } from "@/components/dashboard/BranchSummary";
import { ClosingsRecent } from "@/components/dashboard/ClosingsRecent";
import { RecentHotLeads } from "@/components/dashboard/RecentHotLeads";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { SamanthaDigest, type SamanthaDigestTag } from "@/components/dashboard/SamanthaDigest";
import { OverviewMonitorClient } from "@/components/overview/OverviewMonitorClient";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { readCampaignsCache } from "@/lib/campaignsCache";
import { formatIdrCompact, formatMonthYearId } from "@/lib/formatters";
import type { BranchDto, ClosingDto, LeadDto } from "@/types/dashboard.types";
import type { SettingsDto } from "@/types/tenant.types";

import styles from "./DashboardClient.module.css";

function isSameMonth(iso: string, now: Date): boolean {
  const date = new Date(iso);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

/**
 * Fetches this app's own `/api/leads`, `/api/closings`, `/api/branches` proxy routes and renders
 * the Overview page (FINAL UI REBUILD, matching the reference screenshot: KPI strip, Samantha Daily
 * Digest, Hot Leads Terbaru, Closing Terbaru, Ringkasan per Cabang).
 *
 * Still never calls `/api/campaigns` (Meta Ads data) on mount — same real bug fix this component
 * has documented since the pre-rebuild version (that used to trip Meta's rate limit on every
 * dashboard visit). "Belanja Iklan" and the Samantha Digest's verdict counts instead read whatever
 * snapshot `/meta-ads` already cached to `localStorage` via `readCampaignsCache()` — a synchronous
 * local read, not a network call — so they're simply absent until the user has pulled data on the
 * Kampanye page at least once, never fetched fresh from here.
 *
 * `ObjectiveProgress` (the old "Overview Bulan Ini" objective-progress bar) is intentionally no
 * longer rendered here — the reference screenshot's Overview doesn't include it. The component,
 * its route (`/api/objective`), and its own tests are untouched; a manager can still see/set
 * objectives on the dedicated `/objective` page.
 *
 * AAOS Overview Monitor Phase O2: this exact function/content is now ONLY the AUTOMOTIVE branch,
 * rendered by the new top-level `DashboardClient` wrapper below (renamed to `AutomotiveOverview`,
 * body otherwise byte-for-byte unchanged — see that wrapper's own docstring for the real
 * `isProperty` branching this extraction enables). `DashboardClient.test.tsx` asserts AUTOMOTIVE
 * still renders this exact content unchanged.
 */
function AutomotiveOverview(): React.ReactElement {
  const [leads, setLeads] = useState<readonly LeadDto[] | undefined>(undefined);
  const [closings, setClosings] = useState<readonly ClosingDto[] | undefined>(undefined);
  const [branches, setBranches] = useState<readonly BranchDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const [leadsRes, closingsRes, branchesRes] = await Promise.all([
          fetch("/api/leads"),
          fetch("/api/closings"),
          fetch("/api/branches"),
        ]);
        if (!leadsRes.ok || !closingsRes.ok || !branchesRes.ok) {
          throw new Error("Gagal memuat data dashboard.");
        }
        const leadsBody = (await leadsRes.json()) as { leads: readonly LeadDto[] };
        const closingsBody = (await closingsRes.json()) as { closings: readonly ClosingDto[] };
        const branchesBody = (await branchesRes.json()) as { branches: readonly BranchDto[] };
        if (!cancelled) {
          setLeads(leadsBody.leads);
          setClosings(closingsBody.closings);
          setBranches(branchesBody.branches);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat data dashboard.");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (leads === undefined || closings === undefined || branches === undefined) {
    return <LoadingSpinner />;
  }

  const now = new Date();
  // KPI strip's "bulan ini" scope: `GET /api/v1/leads` returns every lead ever for a branch (no
  // date filter server-side, unlike `/api/v1/closings` which already defaults to the current
  // month) — filtered here so "Hot Leads"/"Leads Total" actually mean "this month", not "all time".
  const leadsThisMonth = leads.filter((lead) => isSameMonth(lead.createdAt, now));
  const hotLeads = leadsThisMonth.filter((lead) => lead.temperature === "HOT").length;
  const leadsTotal = leadsThisMonth.length;
  // `closings` is already scoped to the current calendar month by `aaos-api`'s own default
  // (`/api/closings` passes no fromDate/toDate — see that route's docstring).
  const testDrive = closings.filter((closing) => closing.closingType === "TEST_DRIVE").length;
  const spk = closings.filter((closing) => closing.closingType === "SPK").length;
  const komisiTotal = closings.reduce((sum, closing) => sum + (closing.commissionIdr ?? 0), 0);

  const metaCache = readCampaignsCache();
  const cachedAds = metaCache?.data.ads ?? [];
  const pauseAds = cachedAds.filter((ad) => ad.verdict === "PAUSE");
  const scaleAds = cachedAds.filter((ad) => ad.verdict === "SCALE");
  const fixAds = cachedAds.filter((ad) => ad.verdict === "FIX");
  const pauseSpend = pauseAds.reduce((sum, ad) => sum + ad.metrics.spend, 0);
  const bestScaleAd = scaleAds
    .filter((ad) => ad.metrics.rphD3 !== null)
    .sort((a, b) => (a.metrics.rphD3 ?? 0) - (b.metrics.rphD3 ?? 0))[0];

  const digestParts: string[] = [];
  if (pauseAds.length > 0) {
    digestParts.push(
      `Pause ${pauseAds.length} iklan boros, estimasi hemat ${formatIdrCompact(pauseSpend)}/bulan`,
    );
  }
  if (bestScaleAd !== undefined) {
    digestParts.push(`Scale ${bestScaleAd.stableId} karena Rp/D3 di bawah rata-rata`);
  }
  if (fixAds.length > 0) {
    digestParts.push(`${fixAds.length} iklan perlu di-fix`);
  }
  const digestText =
    metaCache === undefined
      ? "Belum ada data iklan tersimpan — tarik data di halaman Kampanye untuk melihat ringkasan Samantha."
      : digestParts.length > 0
        ? `${digestParts.join(". ")}.`
        : "Semua iklan dalam kondisi baik — tidak ada yang perlu di-pause/scale/fix saat ini.";

  const digestTags: SamanthaDigestTag[] = [];
  if (pauseAds.length > 0) {
    digestTags.push({ label: `${pauseAds.length} perlu PAUSE`, tone: "pause" });
  }
  if (scaleAds.length > 0) {
    digestTags.push({ label: `${scaleAds.length} perlu SCALE`, tone: "scale" });
  }
  if (fixAds.length > 0) {
    digestTags.push({ label: `${fixAds.length} perlu FIX`, tone: "fix" });
  }

  const salesNameById: Record<string, string> = {};
  for (const branch of branches) {
    for (const salesHuman of branch.team) {
      salesNameById[salesHuman.id] = salesHuman.name;
    }
  }

  const branchRows: BranchSummaryRow[] = branches.map((branch) => ({
    branchId: branch.id,
    displayName: branch.displayName,
    leadsTotal: leadsThisMonth.filter((lead) => lead.branchId === branch.id).length,
    hotCount: leadsThisMonth.filter(
      (lead) => lead.branchId === branch.id && lead.temperature === "HOT",
    ).length,
    spkThisMonth: closings.filter(
      (closing) => closing.branchId === branch.id && closing.closingType === "SPK",
    ).length,
  }));

  return (
    <div className={styles.page}>
      {/* No own <h2>Overview</h2> here — `dashboard/page.tsx`'s `<TopBar title="Overview" />`
          already renders that exact heading right above this component, so a second one duplicated
          it visually. Only the real extra info (the period subtitle) is this component's to show. */}
      <p className={styles.subtitle}>
        Ringkasan operasional DSS Motor hari ini · {formatMonthYearId(now)}
      </p>
      <SummaryCards
        data={{
          hotLeads,
          leadsTotal,
          testDrive,
          spk,
          komisiTotal,
          belanjaIklan: metaCache?.data.totals.spend,
        }}
      />
      <SamanthaDigest
        text={digestText}
        tags={digestTags}
        strategiHref="/campaigns?tab=verdict"
        updatedAt={
          metaCache !== undefined ? new Date(metaCache.fetchedAt).toISOString() : undefined
        }
      />
      <div className={styles.twoCol}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <p className={styles.panelTitle}>🔥 Hot Leads Terbaru</p>
            <Link href="/leads?tab=semua" className={styles.panelLink}>
              Lihat semua →
            </Link>
          </div>
          <RecentHotLeads leads={leads} />
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <p className={styles.panelTitle}>✅ Closing Terbaru</p>
          </div>
          <ClosingsRecent closings={closings} salesNameById={salesNameById} />
          <p className={styles.addClosingHint}>
            + Tambah closing baru
            <br />
            <span className={styles.addClosingHintSub}>via CRM Sales Human</span>
          </p>
        </section>
      </div>
      <BranchSummary rows={branchRows} />
      <CalendarWidget />
    </div>
  );
}

/**
 * `/dashboard`'s real top-level component (AAOS Overview Monitor Phase O2) — branches on the
 * caller's real tenant `vertical`, extending the SAME real `/dashboard` route rather than adding a
 * new one (`docs/PROMPT-AAOS-OVERVIEW-MONITOR.md`'s answered open question 1). PROPERTY tenants get
 * the new full Overview Monitor layout (`OverviewMonitorClient` — KPI strip, agent status, activity
 * feed, campaign table, AI score, lead pipeline, recycling, heatmap, insight bar); AUTOMOTIVE
 * tenants keep today's real `AutomotiveOverview` content, unchanged.
 *
 * Vertical resolution reuses `Sidebar.tsx`'s own real, established pattern EXACTLY: a client-side
 * fetch of `/api/settings` (the same endpoint, no second "who am I" call invented for this one
 * branch), defaulting to the AUTOMOTIVE view until it resolves (or on a failed lookup) — never a
 * flash of the PROPERTY layout for the common (AUTOMOTIVE) case, and never a loading gate placed in
 * front of `AutomotiveOverview`'s own real leads/closings/branches fetches (those still start
 * immediately on mount, exactly as before this phase).
 */
export function DashboardClient(): React.ReactElement {
  const [settings, setSettings] = useState<SettingsDto | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) => (res.ok ? (res.json() as Promise<SettingsDto>) : null))
      .then((data) => {
        if (!cancelled && data !== null) {
          setSettings(data);
        }
      })
      .catch(() => {
        // Best-effort only — a failed lookup keeps the default AUTOMOTIVE view, same discipline as
        // `Sidebar.tsx`'s own identical `/api/settings` fetch.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (settings?.tenant.vertical === "PROPERTY") {
    return (
      <OverviewMonitorClient tenantId={settings.tenant.tenantId} mode={settings.tenant.mode} />
    );
  }

  return <AutomotiveOverview />;
}
