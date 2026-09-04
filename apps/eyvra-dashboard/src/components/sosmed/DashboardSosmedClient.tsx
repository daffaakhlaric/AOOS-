"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDateTimeIdWib, formatNumber } from "@/lib/formatters";
import { PLATFORM_COLOR, PLATFORM_LABEL } from "@/lib/sosmed-format";
import type { ScheduledPostDto, SosmedAccountDto } from "@/types/sosmed.types";

import styles from "./Sosmed.shared.module.css";

interface LoadedData {
  readonly posts: readonly ScheduledPostDto[];
  readonly accounts: readonly SosmedAccountDto[];
}

function isThisMonth(iso: string, now: Date): boolean {
  const date = new Date(iso);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function isToday(iso: string, now: Date): boolean {
  const date = new Date(iso);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

/**
 * `/sosmed` (AAOS-SOSMED-AUTOMATION Phase 5, Page 1) — KPI strip + today's schedule + connected
 * accounts, all real: `accounts connected` and the account list come from the real, masked
 * `GET /api/v1/sosmed/accounts`; `post bulan ini`/`total reach`/`total like`/`total comment` are
 * aggregated client-side from the real `GET /api/v1/sosmed/posts` response (every field —
 * `reach`/`likes`/`comments` — is a real `scheduled_posts` column, never fabricated). The spec's
 * "PERFORMA 7 HARI" chart is intentionally omitted: this app tracks per-post `reach`/engagement
 * only from the moment a post publishes, with no daily time-series rollup table anywhere in
 * `modules/sosmed` to back a real day-by-day chart — same "real-or-omitted" discipline
 * `LookalikeClient.tsx`'s own docstring establishes for its omitted comparison table, rather than
 * fabricating a 7-day trend with no real backing data.
 */
export function DashboardSosmedClient(): React.ReactElement {
  const [data, setData] = useState<LoadedData | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/sosmed/posts").then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat daftar post.");
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
        setData({ posts: postsBody.posts, accounts: accountsBody.accounts });
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat Dashboard Sosmed.");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }

  if (data === undefined) {
    return <LoadingSpinner />;
  }

  const now = new Date();
  const postsThisMonth = data.posts.filter((p) => isThisMonth(p.createdAt, now));
  const publishedPosts = data.posts.filter((p) => p.status === "PUBLISHED");
  const totalReach = publishedPosts.reduce((sum, p) => sum + p.reach, 0);
  const totalLikes = publishedPosts.reduce((sum, p) => sum + p.likes, 0);
  const totalComments = publishedPosts.reduce((sum, p) => sum + p.comments, 0);
  const todaysScheduled = data.posts
    .filter(
      (p) => p.status === "SCHEDULED" && p.scheduledAt !== undefined && isToday(p.scheduledAt, now),
    )
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>Social Media Dashboard</h2>
          <p className={styles.subtitle}>Semua akun terhubung, performa konten, jadwal hari ini</p>
        </div>
        <Link href="/sosmed/studio" className={styles.primaryButton}>
          ✍️ Buat Konten
        </Link>
      </div>

      <div className={styles.kpiStrip} data-testid="sosmed-kpi-strip">
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>Akun Terhubung</p>
          <p className={styles.kpiValue}>{formatNumber(data.accounts.length)}</p>
        </div>
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>Post Bulan Ini</p>
          <p className={styles.kpiValue}>{formatNumber(postsThisMonth.length)}</p>
        </div>
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>Total Reach</p>
          <p className={styles.kpiValue}>{formatNumber(totalReach)}</p>
        </div>
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>Total Like</p>
          <p className={styles.kpiValue}>{formatNumber(totalLikes)}</p>
        </div>
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>Total Comment</p>
          <p className={styles.kpiValue}>{formatNumber(totalComments)}</p>
        </div>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Jadwal Post Hari Ini</p>
        {todaysScheduled.length === 0 ? (
          <EmptyState title="Tidak ada post terjadwal hari ini" icon="📅" />
        ) : (
          <div className={styles.rowList} data-testid="today-schedule-list">
            {todaysScheduled.map((post) => (
              <div key={post.id} className={styles.row}>
                <div className={styles.rowMeta}>
                  <p className={styles.rowTitle}>
                    {post.scheduledAt !== undefined ? formatDateTimeIdWib(post.scheduledAt) : "—"} —{" "}
                    {post.caption.slice(0, 60)}
                    {post.caption.length > 60 ? "…" : ""}
                  </p>
                  <p className={styles.rowDetail}>{post.contentType ?? "—"}</p>
                </div>
                <div className={styles.rowActions}>
                  <Link href={`/sosmed/posts?highlight=${post.id}`} className={styles.linkButton}>
                    Lihat
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Akun Terhubung</p>
        {data.accounts.length === 0 ? (
          <EmptyState
            title="Belum ada akun terhubung"
            description="Hubungkan akun Official atau Sales untuk mulai posting."
            icon="🔌"
            action={
              <Link href="/sosmed/accounts" className={styles.primaryButton}>
                + Hubungkan Akun
              </Link>
            }
          />
        ) : (
          <div className={styles.rowList} data-testid="connected-accounts-list">
            {data.accounts.map((account) => (
              <div key={account.id} className={styles.row}>
                <div className={styles.rowMeta}>
                  <p className={styles.rowTitle}>
                    <span
                      className={styles.platformBadge}
                      style={{ background: PLATFORM_COLOR[account.platform] }}
                    >
                      {PLATFORM_LABEL[account.platform]}
                    </span>{" "}
                    {account.accountName}
                  </p>
                  <p className={styles.rowDetail}>
                    {formatNumber(account.followerCount)} followers ·{" "}
                    {account.status === "CONNECTED"
                      ? "🟢 Connected"
                      : account.status === "EXPIRED"
                        ? "🟡 Token expired"
                        : "🔴 Error"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
