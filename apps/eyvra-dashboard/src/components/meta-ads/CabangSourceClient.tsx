"use client";

import { useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { formatDateTimeIdWib, formatIdr, formatIdrCompact, formatNumber } from "@/lib/formatters";
import { useCampaignsSnapshot } from "@/lib/useCampaignsSnapshot";
import type {
  AdAccountOptionDto,
  AdAccountSummaryDto,
  CampaignAdDto,
} from "@/types/dashboard.types";

import styles from "./CabangSourceClient.module.css";

const ALL_ACCOUNTS = "__ALL__";

/** Screenshot's own bucketing rule (spec transcription item 4 + coordinator note #1): only Cinere/Bintaro/Bandung get their own row; everything else (BOOST, MULTI, and UMUM — "sisanya multi/boost") is folded into one "Multi / Boost" row so no ad is silently dropped from the total. */
const NAMED_BRANCHES: Readonly<Record<string, string>> = {
  CINERE: "Cinere",
  BINTARO: "Bintaro",
  BANDUNG: "Bandung",
};
const MULTI_BOOST_LABEL = "Multi / Boost";
const TOP_CAMPAIGN_LIMIT = 15;

interface SpendLeadRow {
  readonly key: string;
  readonly name: string;
  readonly spend: number;
  readonly lead: number;
}

/** `Rp/Lead` for a group is `groupSpend / groupTotalLead` — NOT a sum/average of per-ad `rphLead` (see `AdMetricsDto.rphLead`'s docstring: a group's real ratio is always spend÷lead, division-by-zero safe here by returning `null`). */
function rpPerLead(spend: number, lead: number): number | null {
  return lead > 0 ? spend / lead : null;
}

function groupByBranch(ads: readonly CampaignAdDto[]): readonly SpendLeadRow[] {
  const named = new Map<string, { spend: number; lead: number }>();
  let restSpend = 0;
  let restLead = 0;
  for (const ad of ads) {
    const label = NAMED_BRANCHES[ad.branch];
    if (label !== undefined) {
      const current = named.get(label) ?? { spend: 0, lead: 0 };
      named.set(label, {
        spend: current.spend + ad.metrics.spend,
        lead: current.lead + ad.metrics.totalLead,
      });
    } else {
      restSpend += ad.metrics.spend;
      restLead += ad.metrics.totalLead;
    }
  }
  const rows: SpendLeadRow[] = [...named.entries()]
    .map(([name, totals]) => ({ key: name, name, ...totals }))
    .sort((a, b) => b.spend - a.spend);
  if (restSpend > 0 || restLead > 0) {
    rows.push({
      key: MULTI_BOOST_LABEL,
      name: MULTI_BOOST_LABEL,
      spend: restSpend,
      lead: restLead,
    });
  }
  return rows;
}

function topCampaignsBySpend(ads: readonly CampaignAdDto[]): readonly SpendLeadRow[] {
  const groups = new Map<string, { spend: number; lead: number }>();
  for (const ad of ads) {
    const current = groups.get(ad.campaignName) ?? { spend: 0, lead: 0 };
    groups.set(ad.campaignName, {
      spend: current.spend + ad.metrics.spend,
      lead: current.lead + ad.metrics.totalLead,
    });
  }
  return [...groups.entries()]
    .map(([name, totals]) => ({ key: name, name, ...totals }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, TOP_CAMPAIGN_LIMIT);
}

/** Unions the `ads[]` of several already-fetched per-account snapshots — the "Semua Akun" merge (coordinator note #6, option (b): a light in-memory-only merge scoped to this card, not a change to the shared single-account `campaignsCache.ts` shape every other `/meta-ads/*` page still assumes). */
function mergeAds(snapshots: readonly AdAccountSummaryDto[]): readonly CampaignAdDto[] {
  return snapshots.flatMap((snapshot) => snapshot.ads);
}

function sumField(ads: readonly CampaignAdDto[], pick: (ad: CampaignAdDto) => number): number {
  return ads.reduce((sum, ad) => sum + pick(ad), 0);
}

interface AccountsState {
  readonly accounts: readonly AdAccountOptionDto[] | undefined;
  readonly loading: boolean;
  readonly error: string | undefined;
}

/**
 * Fetches `GET /api/meta-ads-accounts` once on mount. Judgment call (documented per this app's
 * "never auto-call Meta" discipline — see `MetaAdsClient.tsx`/`DashboardClient.tsx`): this is
 * NOT the same rule as "never call `/api/campaigns` outside an explicit refresh click". That rule
 * exists because a campaign pull fetches full Insights data for every ad and has repeatedly
 * tripped Meta's rate limit; this endpoint only resolves a handful of account *names*
 * (`fields=name`, no `insights` expansion at all — see `MetaApiRequestBuilder.adAccountUrl`), a
 * cheap, low-volume metadata call. Auto-fetching it once when a user explicitly navigates to this
 * page is treated as acceptable; auto-fetching a full campaign pull would not be.
 */
function useAdAccounts(): AccountsState {
  const [accounts, setAccounts] = useState<readonly AdAccountOptionDto[] | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    fetch("/api/meta-ads-accounts")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat daftar akun iklan.");
        }
        return (await res.json()) as readonly AdAccountOptionDto[];
      })
      .then((body) => {
        if (mountedRef.current) {
          setAccounts(body);
        }
      })
      .catch((caught: unknown) => {
        if (mountedRef.current) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat daftar akun iklan.");
        }
      })
      .finally(() => {
        if (mountedRef.current) {
          setLoading(false);
        }
      });
  }, []);

  return { accounts, loading, error };
}

/**
 * "Lead & Spend per Cabang × Source" (`docs/PROMPT-AAOS-DASHBOARD-LEAD-SPEND-CABANG-SOURCE.md`) —
 * embedded at the very top of the Data Iklan page (`MetaAdsClient.tsx`), not a separate route
 * (user feedback: "itu data ada di halaman data iklan jadi di paling atas" — originally shipped
 * as its own `/meta-ads/cabang-source` sub-tab, moved here after that correction). Reuses
 * `useCampaignsSnapshot()` (the SAME `localStorage`-backed cache every other `/meta-ads/*` page
 * reads — coordinator note #5) for the default account's data, with zero extra fetch on mount;
 * `campaignsCache.ts`'s `CAMPAIGNS_CACHE_UPDATED_EVENT` keeps this in sync with
 * `MetaAdsClient.tsx`'s own separate pull state so both halves of the now-shared page always
 * agree after either one's refresh button is clicked. Returns `null` when there's nothing pulled
 * yet — `MetaAdsClient.tsx`'s own page-level loading/error/"Belum ada data" state already covers
 * that for the whole page, so this doesn't duplicate it.
 *
 * Multi-account support (coordinator note #6): the pill selector only renders when
 * `GET /api/meta-ads-accounts` resolves more than 1 configured account. Switching to a
 * non-default account, or to "Semua Akun", is an explicit user click that fetches that account's
 * cached-or-fresh `/api/campaigns?adAccountId=...` snapshot on demand (never on mount) and keeps
 * it in a local, in-memory-only map — this component never touches the shared single-account
 * `campaignsCache.ts` key, so every other single-account page keeps working unchanged.
 *
 * "Per Source" / "Cabang × Source" (item 5 of the spec's deliverables checklist) are deliberately
 * NOT implemented in this pass — see the "Belum tersedia" section below for why, and
 * `docs/PROMPT-AAOS-DASHBOARD-LEAD-SPEND-CABANG-SOURCE.md` coordinator note #7 for the real,
 * scoped follow-up (a new `breakdowns=publisher_platform` Meta Insights fetch, a genuinely new
 * capability this codebase has never used). Per the spec's own "Never do this" list: showing
 * fabricated Facebook/Instagram/Audience Network/Messenger numbers here would be worse than
 * showing nothing.
 */
export function CabangSourceClient(): React.ReactElement | null {
  // `error` from `useCampaignsSnapshot()` is intentionally unread here — `MetaAdsClient.tsx`'s own
  // page-level state already renders the "gagal memuat" error UI for the whole page (see this
  // component's own docstring). `loading` IS still used below, to disable the "↻ Perbarui" button
  // while a default-account pull is in flight.
  const { data: defaultData, fetchedAt, period, loading, pull } = useCampaignsSnapshot();
  const { accounts, error: accountsError } = useAdAccounts();

  // `undefined` means "no explicit choice made yet" — resolves to the default account (the
  // already-cached, zero-extra-fetch view), NOT "Semua Akun". Defaulting to "Semua Akun" would
  // either have to silently under-report (showing only the default account's totals under an
  // "ALL" label until every other account is separately fetched) or auto-fetch every other
  // configured account on mount — the latter is exactly the "never auto-call Meta" rule this
  // page must not violate. "Semua Akun" only merges other accounts in once the user explicitly
  // selects it (or refreshes while it's selected), which is a real user click, not a mount effect.
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);
  const [otherSnapshots, setOtherSnapshots] = useState<
    Readonly<Record<string, AdAccountSummaryDto>>
  >({});
  const [scopeLoading, setScopeLoading] = useState(false);
  const [scopeError, setScopeError] = useState<string | undefined>(undefined);

  const defaultAccountId = defaultData?.id;
  const resolvedPeriod = period ?? "last_30d";
  const effectiveSelection = selectedAccountId ?? defaultAccountId ?? ALL_ACCOUNTS;

  async function fetchAccount(accountId: string, forceRefresh: boolean): Promise<void> {
    setScopeLoading(true);
    setScopeError(undefined);
    try {
      const params = new URLSearchParams({ datePreset: resolvedPeriod, adAccountId: accountId });
      if (forceRefresh) {
        params.set("refresh", "1");
      }
      const res = await fetch(`/api/campaigns?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Gagal memuat data akun iklan ini.");
      }
      const body = (await res.json()) as AdAccountSummaryDto;
      setOtherSnapshots((prev) => ({ ...prev, [accountId]: body }));
    } catch (caught) {
      setScopeError(caught instanceof Error ? caught.message : "Gagal memuat data akun iklan ini.");
    } finally {
      setScopeLoading(false);
    }
  }

  function handleSelectAccount(accountId: string): void {
    setSelectedAccountId(accountId);
    if (accountId === ALL_ACCOUNTS) {
      // Explicit user action → fetch every configured account not yet cached, so "Semua Akun"
      // actually merges all of them rather than silently showing only whichever accounts had
      // already been visited individually.
      for (const account of accounts ?? []) {
        if (account.id !== defaultAccountId && otherSnapshots[account.id] === undefined) {
          void fetchAccount(account.id, false);
        }
      }
      return;
    }
    if (accountId === defaultAccountId) {
      return;
    }
    if (otherSnapshots[accountId] === undefined) {
      void fetchAccount(accountId, false);
    }
  }

  function handleRefresh(): void {
    if (effectiveSelection === ALL_ACCOUNTS) {
      void pull(resolvedPeriod);
      for (const account of accounts ?? []) {
        if (account.id !== defaultAccountId) {
          void fetchAccount(account.id, true);
        }
      }
      return;
    }
    if (effectiveSelection === defaultAccountId) {
      void pull(resolvedPeriod);
      return;
    }
    void fetchAccount(effectiveSelection, true);
  }

  // Real bug fix: this always renders at the very top of `MetaAdsClient.tsx`'s own page, which
  // ALREADY shows a page-level loading spinner / error card / "Belum ada data" empty state
  // further down whenever there's nothing pulled yet. Rendering a second, near-identical
  // loading/error/empty block up here too was confusing (two "no data yet" messages stacked) and
  // collided with `MetaAdsClient`'s own `data-testid="empty-state"`. Nothing to add here until
  // there's real data to show — `MetaAdsClient`'s own state covers that message for the page.
  if (defaultData === undefined) {
    return null;
  }

  const knownAccounts =
    accounts ??
    (defaultAccountId !== undefined ? [{ id: defaultAccountId, name: defaultData.name }] : []);
  const showAccountPills = knownAccounts.length > 1;

  const snapshotsInScope: readonly AdAccountSummaryDto[] =
    effectiveSelection === ALL_ACCOUNTS
      ? [defaultData, ...Object.values(otherSnapshots)]
      : effectiveSelection === defaultAccountId
        ? [defaultData]
        : otherSnapshots[effectiveSelection] !== undefined
          ? [otherSnapshots[effectiveSelection]]
          : [];

  const ads = mergeAds(snapshotsInScope);
  const totalSpend = sumField(ads, (ad) => ad.metrics.spend);
  const totalLead = sumField(ads, (ad) => ad.metrics.totalLead);
  const totalChat = sumField(ads, (ad) => ad.metrics.conversations);
  const totalD3 = sumField(ads, (ad) => ad.metrics.d3);
  const totalD5 = sumField(ads, (ad) => ad.metrics.d5);
  const totalForm = sumField(ads, (ad) => ad.metrics.leadForm);
  const overallRpPerLead = rpPerLead(totalSpend, totalLead);

  const branchRows = groupByBranch(ads);
  const campaignRows = topCampaignsBySpend(ads);

  return (
    <div className={styles.page}>
      <Header onRefresh={handleRefresh} loading={loading || scopeLoading} />

      {showAccountPills ? (
        <div data-testid="account-pills" className={styles.pillRow}>
          <button
            type="button"
            onClick={() => handleSelectAccount(ALL_ACCOUNTS)}
            className={`${styles.pill} ${effectiveSelection === ALL_ACCOUNTS ? styles.pillActive : ""}`}
          >
            🗂 Semua Akun ({knownAccounts.length})
          </button>
          {knownAccounts.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => handleSelectAccount(account.id)}
              className={`${styles.pill} ${effectiveSelection === account.id ? styles.pillActive : ""}`}
            >
              ⚠ {account.name}
            </button>
          ))}
        </div>
      ) : null}

      {accountsError !== undefined ? <ErrorCard message={accountsError} /> : null}
      {scopeError !== undefined ? <ErrorCard message={scopeError} /> : null}
      {scopeLoading ? <p className={styles.updating}>Memuat akun terpilih…</p> : null}

      <section data-testid="cabang-source-kpi-strip" className={styles.kpiStrip}>
        <Kpi label="Belanja" value={formatIdrCompact(totalSpend)} />
        <Kpi label="Total Lead" value={formatNumber(totalLead)} highlight />
        <Kpi
          label="Rp / Lead"
          value={overallRpPerLead !== null ? formatIdrCompact(overallRpPerLead) : "—"}
          highlight
        />
        <Kpi label="Chat" value={formatNumber(totalChat)} />
        <Kpi
          label="D3 / D5 / Form"
          value={`${formatNumber(totalD3)}/${formatNumber(totalD5)}/${formatNumber(totalForm)}`}
        />
      </section>

      <SpendLeadTable
        testId="cabang-source-per-cabang"
        title="📍 Per Cabang"
        caption="Cabang dari nama campaign/adset. Hanya Cinere/Bintaro/Bandung yang berlabel khusus; sisanya multi/boost."
        rows={branchRows}
        nameHeader="NAMA"
      />

      <SpendLeadTable
        testId="cabang-source-top-campaign"
        title={`🏆 Top Campaign (${TOP_CAMPAIGN_LIMIT} campaign belanja terbesar)`}
        caption={`${TOP_CAMPAIGN_LIMIT} campaign belanja terbesar pada rentang ini.`}
        rows={campaignRows}
        nameHeader="NAMA"
      />

      <section data-testid="cabang-source-per-source" className={styles.section}>
        <h3 className={styles.sectionTitle}>🌐 Per Source</h3>
        <EmptyState
          title="Belum tersedia"
          description='Meta belum ditarik dengan breakdown "publisher_platform" (Facebook/Instagram/Audience Network/Messenger). Menampilkan angka di sini sebelum fetch itu nyata berarti menampilkan data karangan — lihat dokumentasi tugas ini (coordinator note #7) untuk rencana pengerjaannya.'
        />
      </section>

      <section data-testid="cabang-source-cross" className={styles.section}>
        <h3 className={styles.sectionTitle}>✖️ Cabang × Source</h3>
        <EmptyState
          title="Belum tersedia"
          description="Silang cabang & platform membutuhkan breakdown per-source di atas — belum tersedia untuk alasan yang sama."
        />
      </section>

      {fetchedAt !== undefined ? (
        <p data-testid="cabang-source-footer" className={styles.footer}>
          Ditarik: {formatDateTimeIdWib(new Date(fetchedAt).toISOString())} · periode{" "}
          {resolvedPeriod}
        </p>
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  highlight,
}: {
  readonly label: string;
  readonly value: string;
  readonly highlight?: boolean;
}): React.ReactElement {
  return (
    <div className={styles.kpiCell}>
      <p className={styles.kpiLabel}>{label}</p>
      <p className={`${styles.kpiValue} ${highlight === true ? styles.kpiValueBlue : ""}`}>
        {value}
      </p>
    </div>
  );
}

function SpendLeadTable({
  testId,
  title,
  caption,
  rows,
  nameHeader,
}: {
  readonly testId: string;
  readonly title: string;
  readonly caption: string;
  readonly rows: readonly SpendLeadRow[];
  readonly nameHeader: string;
}): React.ReactElement {
  return (
    <section data-testid={testId} className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {rows.length === 0 ? (
        <p className={styles.mutedText}>Tidak ada data.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.tableHeadRow}>
                <th>{nameHeader}</th>
                <th>SPEND</th>
                <th>LEAD</th>
                <th>RP·LEAD</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const perLead = rpPerLead(row.spend, row.lead);
                return (
                  <tr key={row.key} className={styles.tableRow}>
                    <td className={styles.tableCell}>{row.name}</td>
                    <td className={styles.tableCell}>{formatIdr(row.spend)}</td>
                    <td className={styles.tableCell}>{formatNumber(row.lead)}</td>
                    <td className={styles.tableCell}>
                      {perLead !== null ? formatIdr(perLead) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.caption}>{caption}</p>
    </section>
  );
}

function Header({
  onRefresh,
  loading,
}: {
  readonly onRefresh: () => void;
  readonly loading: boolean;
}): React.ReactElement {
  return (
    <div className={styles.headerRow}>
      <div>
        <h2 className={styles.title}>📍 Lead & Spend per Cabang × Source</h2>
        <p className={styles.subtitle}>
          Dari Ad Account → dibedah per cabang dan per source (FB/IG/dll). Lead = D3+D5+Form
          (definisi AAOS).
        </p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className={styles.secondaryButton}
      >
        ↻ Perbarui
      </button>
    </div>
  );
}
