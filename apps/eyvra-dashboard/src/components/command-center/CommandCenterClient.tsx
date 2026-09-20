"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { aggregateCampaign, computeCpl } from "@/components/campaigns/campaignInsightMath";
import { aggregateVerdict } from "@/components/meta-ads/CampaignTree";
import { VerdictBadge } from "@/components/meta-ads/VerdictBadge";
import { AgentStatusRow } from "@/components/overview/AgentStatusRow";
import { Card } from "@/components/overview/Card";
import { InsightBar } from "@/components/overview/InsightBar";
import { ActivityFeedSection } from "@/components/overview/ActivityFeedSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MetricCard } from "@/components/ui/MetricCard";
import { stripAdNameSuffix } from "@/lib/adName";
import { formatIdr, formatIdrCompact, formatNumber } from "@/lib/formatters";
import type {
  AbTestDto,
  CampaignSummaryDto,
  CreativePackageDto,
  OverviewResponseDto,
} from "@/types/dashboard.types";

import styles from "./CommandCenterClient.module.css";

/** Highest-priority-first — mirrors `VerdictCards.tsx`'s own real `ACTIONABLE_PRIORITY` precedence exactly (same `VerdictEngine` ordering, KEEP/REVIEW excluded — "nothing to do"). */
const ACTIONABLE_PRIORITY = ["FIX", "PAUSE", "SCALE", "REFRESH"] as const;
/** The subset of actionable verdicts that mean "something is genuinely wrong" — mirrors the mockup's red "Needs Attention" panel. */
const NEEDS_ATTENTION_VERDICTS = new Set(["FIX", "PAUSE"]);
/** The subset that means "real, detected upside" — mirrors the mockup's green "Opportunities" panel, and the exact same real `SCALE` decision `OpportunitiesCard`'s `SCALING_OPPORTUNITY` detector is itself derived from. */
const OPPORTUNITY_VERDICTS = new Set(["SCALE"]);

interface CampaignVerdictRow {
  readonly campaign: CampaignSummaryDto;
  readonly verdict: string;
  readonly spend: number;
  readonly cpl: number | null;
}

/**
 * Real, deterministic per-campaign verdict + spend/CPL, computed the EXACT same way
 * `VerdictCards.tsx`/`UnifiedCampaignTable.tsx` already do (`aggregateVerdict` over every ad's real
 * `VerdictEngine` output, `aggregateCampaign`/`computeCpl` for the real spend/CPL rollup, with the
 * same real campaign-level-spend fallback `VerdictCards.tsx` documents for a delayed ad-level pull) —
 * never a second, parallel verdict computation invented for this page.
 */
function computeCampaignVerdicts(
  campaigns: readonly CampaignSummaryDto[],
): readonly CampaignVerdictRow[] {
  return campaigns.map((campaign) => {
    const verdict = aggregateVerdict(
      campaign.adSets.flatMap((adSet) => adSet.ads.map((ad) => ad.verdict)),
    );
    const aggregate = aggregateCampaign(campaign);
    const adLevelSpendAvailable = aggregate.spend > 0;
    const spend = adLevelSpendAvailable ? aggregate.spend : campaign.spend;
    const cpl = adLevelSpendAvailable ? computeCpl(aggregate.spend, aggregate.totalLead) : null;
    return { campaign, verdict, spend, cpl };
  });
}

function VerdictListPanel({
  title,
  tone,
  rows,
  emptyDescription,
}: {
  readonly title: string;
  readonly tone: "attention" | "opportunity";
  readonly rows: readonly CampaignVerdictRow[];
  readonly emptyDescription: string;
}): React.ReactElement {
  return (
    <section
      data-testid={`cc-panel-${tone}`}
      className={`${styles.verdictPanel} ${tone === "attention" ? styles.panelAttention : styles.panelOpportunity}`}
    >
      <div className={styles.panelHeader}>
        <p className={styles.panelTitle}>{title}</p>
        <span className={styles.panelCount}>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Tidak ada saat ini" description={emptyDescription} />
      ) : (
        <ul className={styles.panelList}>
          {rows.slice(0, 5).map((row) => (
            <li key={row.campaign.id} className={styles.panelRow}>
              <span className={styles.panelRowName}>{stripAdNameSuffix(row.campaign.name)}</span>
              <VerdictBadge verdict={row.verdict} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Simplified real "Samantha Attention Queue" — every campaign with a real actionable verdict
 * (FIX/PAUSE/SCALE/REFRESH), priority-sorted, with its real spend/CPL. The mockup's tabbed
 * (Critical/Action Required/Opportunities/Monitoring/Completed) table with per-row thumbnail/
 * CTR-sparkline/confidence%/plan-summary has no real backing data anywhere in this codebase today
 * (that shape belongs to an LLM-generated plan this app doesn't compute at the account-wide level —
 * `CampaignInsightPanel`'s real LLM analysis is per-campaign, on-demand, not a background job over
 * every campaign) — simplified honestly to the real verdict/spend/CPL this page can already prove,
 * rather than fabricating tabs/confidence/thumbnails with no real source.
 */
function AttentionQueueTable({
  rows,
}: {
  readonly rows: readonly CampaignVerdictRow[];
}): React.ReactElement {
  const actionable = rows
    .filter((row) => (ACTIONABLE_PRIORITY as readonly string[]).includes(row.verdict))
    .sort(
      (a, b) =>
        ACTIONABLE_PRIORITY.indexOf(a.verdict as never) -
        ACTIONABLE_PRIORITY.indexOf(b.verdict as never),
    );

  if (actionable.length === 0) {
    return (
      <EmptyState
        title="Tidak ada campaign yang butuh aksi"
        description="Semua campaign KEEP/REVIEW saat ini."
      />
    );
  }

  return (
    <table className={styles.queueTable} data-testid="cc-attention-queue">
      <thead>
        <tr>
          <th>Campaign</th>
          <th>Verdict</th>
          <th>Spend</th>
          <th>CPL</th>
        </tr>
      </thead>
      <tbody>
        {actionable.map((row) => (
          <tr key={row.campaign.id} data-testid={`cc-queue-row-${row.campaign.id}`}>
            <td>{stripAdNameSuffix(row.campaign.name)}</td>
            <td>
              <VerdictBadge verdict={row.verdict} />
            </td>
            <td>{formatIdr(row.spend)}</td>
            <td>{row.cpl !== null ? formatIdr(row.cpl) : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Real "Active Experiments" — `GET /api/abtesting?status=RUNNING`, the SAME real endpoint/DTO
 * `AbTestingClient.tsx` already uses for its own RUNNING tab. Independent, best-effort fetch (never
 * blocks the rest of this page — same discipline `CampaignHealthCard.tsx`'s own `loadTrend` follows):
 * a genuine failure just leaves this card in its honest "belum bisa dimuat" state.
 */
function ActiveExperimentsCard(): React.ReactElement {
  const [tests, setTests] = useState<readonly AbTestDto[] | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/abtesting?status=RUNNING")
      .then((res) => (res.ok ? (res.json() as Promise<{ tests: readonly AbTestDto[] }>) : null))
      .then((body) => {
        if (!cancelled) {
          if (body === null) {
            setFailed(true);
          } else {
            setTests(body.tests);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <EmptyState
        title="Data eksperimen belum bisa dimuat"
        description="Coba lagi lewat halaman Experiments."
      />
    );
  }

  if (tests === undefined) {
    return <LoadingSpinner />;
  }

  if (tests.length === 0) {
    return (
      <EmptyState
        title="Tidak ada eksperimen aktif"
        description="Belum ada A/B test yang sedang RUNNING."
      />
    );
  }

  return (
    <ul className={styles.experimentList} data-testid="cc-active-experiments">
      {tests.slice(0, 5).map((test) => (
        <li key={test.id} className={styles.experimentRow}>
          <span className={styles.experimentName}>{test.name}</span>
          <span className={styles.experimentMeta}>
            {test.variants.length} varian
            {test.startedAt !== undefined
              ? ` · mulai ${new Date(test.startedAt).toLocaleDateString("id-ID")}`
              : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Real "Kai Creative Production" — EYVRA SAMANTHA V2 + KAI V2 Phase 55 correction. Phase 50's own
 * doc claimed no real account-wide creative-package aggregate endpoint exists; that was wrong —
 * `GET /api/creative?limit=200` (no server-side `listingId` filter) already returns every package
 * account-wide, the SAME real proxy route `KaiStudioClient.tsx`'s "Concepts grid" column already
 * calls with the same real 200-item cap. This card just counts the real
 * `CreativePackageStatusDto` values that list already carries (`GENERATING`/`PENDING`/`APPROVED`) —
 * no new backend surface, no fabricated confidence/ETA, and the same honest 200-item cap Kai
 * Studio itself already lives with (not a true unbounded account total).
 */
function KaiProductionSummaryCard(): React.ReactElement {
  const [packages, setPackages] = useState<readonly CreativePackageDto[] | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/creative?limit=200")
      .then((res) =>
        res.ok ? (res.json() as Promise<{ packages: readonly CreativePackageDto[] }>) : null,
      )
      .then((body) => {
        if (!cancelled) {
          if (body === null) {
            setFailed(true);
          } else {
            setPackages(body.packages);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <EmptyState
        title="Data produksi Kai belum bisa dimuat"
        description="Coba lagi lewat halaman Kai Studio."
      />
    );
  }

  if (packages === undefined) {
    return <LoadingSpinner />;
  }

  if (packages.length === 0) {
    return (
      <EmptyState
        title="Belum ada creative package"
        description="Belum ada brief yang dikirim ke Kai."
      />
    );
  }

  const generating = packages.filter((pkg) => pkg.status === "GENERATING").length;
  const pending = packages.filter((pkg) => pkg.status === "PENDING").length;
  const approved = packages.filter((pkg) => pkg.status === "APPROVED").length;

  return (
    <div data-testid="cc-kai-production">
      <div className={styles.kpiStrip}>
        <MetricCard label="Sedang Digenerate" value={formatNumber(generating)} />
        <MetricCard label="Menunggu Review" value={formatNumber(pending)} />
        <MetricCard label="Disetujui" value={formatNumber(approved)} />
      </div>
      <Link href="/kai-studio" className={styles.viewAllLink}>
        Lihat Kai Studio →
      </Link>
    </div>
  );
}

/**
 * `/command-center` — EYVRA SAMANTHA V2 + KAI V2 Phase 50 (PROMPT 68), the first real page for the
 * new 8-item nav's `Command Center` item. Builds the REAL, data-backed subset of the user's own
 * reference-screenshot mockup this codebase can honestly support today:
 *
 *  - KPI strip: Total Spend + Total Leads + CPL, reusing O1's real single `GET /api/overview`
 *    aggregate (`OverviewCampaignsSummaryDto.totalSpend`, `OverviewLeadsSummaryDto.hot/warm/cold`).
 *    The mockup's "Qualified Leads"/"CPQL"/"Bookings" cells are DELIBERATELY OMITTED — this session's
 *    own established finding (see `eyvra-v2-ui-design-reference` memory) is that this codebase has no
 *    real CRM/lead-stage system, so "qualified" has no real backing data; never fabricated here.
 *  - "Your AI Team is Working": reuses `InsightBar` (real LLM daily insight) + `AgentStatusRow` (real
 *    per-agent `agent_activities`/AI-Judge scores) verbatim — the exact same real components
 *    `OverviewMonitorClient.tsx` already renders for PROPERTY's `/dashboard`, not a re-derived copy.
 *  - Needs Attention / Opportunities: real, deterministic per-campaign verdict aggregation (see
 *    `computeCampaignVerdicts` above) over the SAME real campaign/ad-set/ad tree
 *    `OverviewCampaignsSummaryDto.campaigns` already carries — FIX/PAUSE -> Needs Attention,
 *    SCALE -> Opportunities. This mirrors `OpportunitiesCard.tsx`'s own real `SCALING_OPPORTUNITY`
 *    detector logic (itself derived from Campaign Health's real `SCALE` decisions) at an account-wide
 *    level instead of per-campaign, without inventing a new backend endpoint.
 *  - Samantha Attention Queue: simplified to the real verdict/spend/CPL table `AttentionQueueTable`
 *    computes above — no confidence%/thumbnails/tabs (no real backing data for those, see that
 *    component's own doc).
 *  - Active Experiments: real `GET /api/abtesting?status=RUNNING` list (`ActiveExperimentsCard`).
 *  - Agent Activity: reuses `ActivityFeedSection` over O1's real `activities` field verbatim (the
 *    same real feed `/activity`'s `ActivityHubClient` and `OverviewMonitorClient` both already show).
 *  - "Kai Creative Production": real GENERATING/PENDING/APPROVED counts from the SAME real
 *    `GET /api/creative?limit=200` list `KaiStudioClient.tsx` already uses (see
 *    `KaiProductionSummaryCard` above) — corrected in Phase 55 from an honestly-omitted empty state
 *    once the audit found this account-wide list already exists.
 *  - "Performance Overview" line chart (Spend/Leads/CPQL over time): HONESTLY OMITTED entirely (no
 *    Card at all, not even an empty one) — this codebase has no real account-wide daily
 *    spend/leads/CPQL time-series endpoint to plot; a real future backend gap.
 *
 * Data source: the SAME real `GET /api/overview` proxy `OverviewMonitorClient.tsx` already
 * established (`resolveRouteSession`+`callAaosApi` convention, see that route's own doc) — no new
 * backend surface invented for this page. This page renders for EVERY tenant (not vertical-gated,
 * unlike `/dashboard`'s `AutomotiveOverview`/`OverviewMonitorClient` split) since `/api/overview`
 * itself has no real vertical branching — every section here independently honest-degrades via its
 * own `undefined`/empty checks regardless of vertical.
 */
export function CommandCenterClient(): React.ReactElement {
  const [data, setData] = useState<OverviewResponseDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/overview")
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Gagal memuat Command Center.");
        }
        return (await res.json()) as OverviewResponseDto;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat Command Center.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (data === undefined) {
    return <LoadingSpinner />;
  }

  const totalSpend = data.campaigns?.totalSpend;
  const totalLeads =
    data.leads !== undefined ? data.leads.hot + data.leads.warm + data.leads.cold : undefined;
  const cpl =
    totalSpend !== undefined && totalLeads !== undefined && totalLeads > 0
      ? totalSpend / totalLeads
      : undefined;

  const verdictRows =
    data.campaigns !== undefined ? computeCampaignVerdicts(data.campaigns.campaigns) : undefined;
  const needsAttentionRows = verdictRows?.filter((row) =>
    NEEDS_ATTENTION_VERDICTS.has(row.verdict),
  );
  const opportunityRows = verdictRows?.filter((row) => OPPORTUNITY_VERDICTS.has(row.verdict));

  return (
    <div className={styles.page} data-testid="command-center">
      <InsightBar insight={data.insight} />

      {totalSpend !== undefined || totalLeads !== undefined ? (
        <div className={styles.kpiStrip} data-testid="cc-kpi-strip">
          {totalSpend !== undefined ? (
            <MetricCard label="Total Spend" value={formatIdrCompact(totalSpend)} />
          ) : null}
          {totalLeads !== undefined ? (
            <MetricCard label="Total Leads" value={formatNumber(totalLeads)} />
          ) : null}
          {cpl !== undefined ? <MetricCard label="CPL" value={formatIdr(cpl)} /> : null}
        </div>
      ) : (
        <EmptyState
          title="Data spend/leads belum tersedia"
          description={
            data.errors.campaigns ??
            data.errors.leads ??
            "Belum ada data campaign/lead untuk periode ini."
          }
        />
      )}

      <Card title="Your AI Team is Working" accentColor="var(--v2-samantha)">
        <AgentStatusRow agentStatus={data.agentStatus} />
      </Card>

      {verdictRows !== undefined ? (
        <div className={styles.twoCol}>
          <VerdictListPanel
            title="Needs Attention"
            tone="attention"
            rows={needsAttentionRows ?? []}
            emptyDescription="Tidak ada campaign kritis saat ini."
          />
          <VerdictListPanel
            title="Opportunities"
            tone="opportunity"
            rows={opportunityRows ?? []}
            emptyDescription="Belum ada peluang scaling terdeteksi."
          />
        </div>
      ) : null}

      <Card title="Samantha Attention Queue" accentColor="var(--v2-samantha)">
        {verdictRows !== undefined ? (
          <AttentionQueueTable rows={verdictRows} />
        ) : (
          <EmptyState
            title="Data campaign belum tersedia"
            description={data.errors.campaigns ?? "Belum ada data campaign untuk ditampilkan."}
          />
        )}
        <Link href="/campaigns" className={styles.viewAllLink}>
          Lihat semua campaign →
        </Link>
      </Card>

      <div className={styles.twoCol}>
        <Card title="Active Experiments" accentColor="var(--v2-menu-analytics)">
          <ActiveExperimentsCard />
        </Card>
        <Card title="Kai Creative Production" accentColor="var(--v2-kai)">
          <KaiProductionSummaryCard />
        </Card>
      </div>

      <Card title="Agent Activity" accentColor="var(--v2-menu-activity)">
        <ActivityFeedSection activities={data.activities} />
      </Card>
    </div>
  );
}

export default CommandCenterClient;
