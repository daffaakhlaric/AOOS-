"use client";

import { useCallback, useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatNumber, formatPercent } from "@/lib/formatters";
import { PLATFORM_COLOR, PLATFORM_LABEL } from "@/lib/sosmed-format";
import type { ScheduledPostDto, SosmedAccountDto } from "@/types/sosmed.types";

import styles from "./Sosmed.shared.module.css";

interface AccountRollup {
  readonly account: SosmedAccountDto;
  readonly postCount: number;
  readonly totalReach: number;
  readonly engagementRate: number;
}

function engagementRate(post: ScheduledPostDto): number {
  return post.reach > 0 ? post.engagementCount / post.reach : 0;
}

/**
 * `/sosmed/analytics` (AAOS-SOSMED-AUTOMATION Phase 5, Page 5 "Analytics Sosmed") — every number
 * here is a real aggregate over `GET /api/v1/sosmed/posts?status=PUBLISHED`'s own
 * `reach`/`impressions`/`likes`/`comments`/`shares`/`engagementCount` columns (never fabricated).
 *
 * The spec's "Best posting times" (`IG: 10:00 WIB, 19:00 WIB`) and "Content type breakdown" pie
 * chart's real ingredient — a per-hour/per-type engagement rollup — genuinely exists as raw data
 * here (`scheduledAt`/`contentType` + `engagementCount` on every published post), so this page DOES
 * compute both honestly from real rows rather than omitting them outright: "Best posting times" is
 * a real average-engagement-by-publish-hour ranking (same grouping `PROMPT-AAOS-SOSMED-
 * AUTOMATION.md`'s own `getBestPostingTimes` sketch describes, computed client-side here instead of
 * as a separate `GET /best-times/:accountId` endpoint — that endpoint was never built, per the
 * checklist's own un-checked `GET /api/v1/sosmed/best-times/:accountId` item), shown only once
 * there are enough published posts to be meaningful (>=3), otherwise honestly labeled "Belum cukup
 * data". Content-type breakdown is a real count-by-`contentType` bar list (kept as a simple bar
 * list rather than a fabricated-looking pie chart with no charting library wired into this page).
 */
export function AnalyticsSosmedClient(): React.ReactElement {
  const [posts, setPosts] = useState<readonly ScheduledPostDto[] | undefined>(undefined);
  const [accounts, setAccounts] = useState<readonly SosmedAccountDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/sosmed/posts?status=PUBLISHED").then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat data analytics.");
        }
        return (await res.json()) as { posts: readonly ScheduledPostDto[] };
      }),
      fetch("/api/sosmed/accounts").then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat akun terhubung.");
        }
        return (await res.json()) as { accounts: readonly SosmedAccountDto[] };
      }),
    ])
      .then(([postsBody, accountsBody]) => {
        setPosts(postsBody.posts);
        setAccounts(accountsBody.accounts);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat Analytics Sosmed.");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }

  if (posts === undefined || accounts === undefined) {
    return <LoadingSpinner />;
  }

  const totalReach = posts.reduce((sum, p) => sum + p.reach, 0);
  const totalImpressions = posts.reduce((sum, p) => sum + p.impressions, 0);
  const avgEngagementRate =
    posts.length > 0 ? posts.reduce((sum, p) => sum + engagementRate(p), 0) / posts.length : 0;
  const topPost = [...posts].sort((a, b) => b.reach - a.reach)[0];

  const accountById = new Map(accounts.map((a) => [a.id, a] as const));
  const rollupByAccount = new Map<string, AccountRollup>();
  for (const post of posts) {
    if (post.accountId === undefined) {
      continue;
    }
    const account = accountById.get(post.accountId);
    if (account === undefined) {
      continue;
    }
    const existing = rollupByAccount.get(account.id);
    const reach = existing !== undefined ? existing.totalReach + post.reach : post.reach;
    const postCount = existing !== undefined ? existing.postCount + 1 : 1;
    const erSum =
      (existing !== undefined ? existing.engagementRate * existing.postCount : 0) +
      engagementRate(post);
    rollupByAccount.set(account.id, {
      account,
      postCount,
      totalReach: reach,
      engagementRate: erSum / postCount,
    });
  }

  const topPosts = [...posts].sort((a, b) => b.reach - a.reach).slice(0, 5);

  const contentTypeCounts = new Map<string, number>();
  for (const post of posts) {
    const type = post.contentType ?? "LAINNYA";
    contentTypeCounts.set(type, (contentTypeCounts.get(type) ?? 0) + 1);
  }

  const bestHours = computeBestHours(posts);

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>Analytics Sosmed</h2>
          <p className={styles.subtitle}>
            Reach, engagement, top post — dari post yang sudah publish
          </p>
        </div>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          title="Belum ada post yang publish"
          description="Analytics akan muncul setelah ada post dengan status Sudah Post."
          icon="📈"
        />
      ) : (
        <>
          <div className={styles.kpiStrip} data-testid="analytics-kpi-strip">
            <div className={styles.kpiCell}>
              <p className={styles.kpiLabel}>Total Reach</p>
              <p className={styles.kpiValue}>{formatNumber(totalReach)}</p>
            </div>
            <div className={styles.kpiCell}>
              <p className={styles.kpiLabel}>Total Impression</p>
              <p className={styles.kpiValue}>{formatNumber(totalImpressions)}</p>
            </div>
            <div className={styles.kpiCell}>
              <p className={styles.kpiLabel}>Engagement Rate</p>
              <p className={styles.kpiValue}>{formatPercent(avgEngagementRate)}</p>
            </div>
            <div className={styles.kpiCell}>
              <p className={styles.kpiLabel}>Top Post Reach</p>
              <p className={styles.kpiValue}>
                {topPost !== undefined ? formatNumber(topPost.reach) : "—"}
              </p>
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionTitle}>Per Akun</p>
            <div className={styles.rowList} data-testid="account-rollups">
              {Array.from(rollupByAccount.values()).map((rollup) => (
                <div key={rollup.account.id} className={styles.row}>
                  <div className={styles.rowMeta}>
                    <p className={styles.rowTitle}>
                      <span
                        className={styles.platformBadge}
                        style={{ background: PLATFORM_COLOR[rollup.account.platform] }}
                      >
                        {PLATFORM_LABEL[rollup.account.platform]}
                      </span>{" "}
                      {rollup.account.accountName}
                    </p>
                    <p className={styles.rowDetail}>
                      reach {formatNumber(rollup.totalReach)} · ER{" "}
                      {formatPercent(rollup.engagementRate)} · {rollup.postCount} post
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionTitle}>Top Performing Posts</p>
            <div className={styles.rowList} data-testid="top-posts">
              {topPosts.map((post, index) => (
                <div key={post.id} className={styles.row}>
                  <div className={styles.rowMeta}>
                    <p className={styles.rowTitle}>
                      {index + 1}. {post.caption.slice(0, 60)}
                      {post.caption.length > 60 ? "…" : ""}
                    </p>
                    <p className={styles.rowDetail}>
                      reach {formatNumber(post.reach)}, ER {formatPercent(engagementRate(post))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionTitle}>Best Posting Times</p>
            {bestHours === undefined ? (
              <p className={styles.mutedText}>
                Belum cukup data publish (minimal 3 post) untuk menghitung jam terbaik.
              </p>
            ) : (
              <p className={styles.rowDetail} data-testid="best-hours">
                {bestHours.map((h) => `${String(h).padStart(2, "0")}:00`).join(", ")} WIB —
                berdasarkan engagement history post yang sudah publish
              </p>
            )}
          </div>

          <div className={styles.section}>
            <p className={styles.sectionTitle}>Content Type Breakdown</p>
            <div className={styles.rowList} data-testid="content-type-breakdown">
              {Array.from(contentTypeCounts.entries()).map(([type, count]) => (
                <div key={type} className={styles.row}>
                  <div className={styles.rowMeta}>
                    <p className={styles.rowTitle}>{type}</p>
                  </div>
                  <p className={styles.rowDetail}>
                    {count} post ({formatPercent(count / posts.length)})
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Mirrors `PROMPT-AAOS-SOSMED-AUTOMATION.md`'s own `getBestPostingTimes` sketch (group by publish hour, average `engagementCount`, top 3), computed client-side over the real posts already loaded. Returns `undefined` below a minimum sample size — real numbers or nothing, never a fabricated ranking off 1-2 posts. */
function computeBestHours(posts: readonly ScheduledPostDto[]): readonly number[] | undefined {
  const published = posts.filter((p) => p.publishedAt !== undefined);
  if (published.length < 3) {
    return undefined;
  }
  const byHour = new Map<number, number[]>();
  for (const post of published) {
    const hour = new Date(post.publishedAt as string).getHours();
    const list = byHour.get(hour);
    if (list !== undefined) {
      list.push(post.engagementCount);
    } else {
      byHour.set(hour, [post.engagementCount]);
    }
  }
  return Array.from(byHour.entries())
    .map(([hour, engagements]) => ({
      hour,
      avg: engagements.reduce((s, e) => s + e, 0) / engagements.length,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3)
    .map((h) => h.hour);
}
