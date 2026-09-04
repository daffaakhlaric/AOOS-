"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDateId, formatDateTimeIdWib } from "@/lib/formatters";
import { PLATFORM_COLOR, PLATFORM_LABEL } from "@/lib/sosmed-format";
import type { ScheduledPostDto, SosmedAccountDto } from "@/types/sosmed.types";

import styles from "./Sosmed.shared.module.css";

/**
 * `/sosmed/calendar` (AAOS-SOSMED-AUTOMATION Phase 5, Page 2 "Content Calendar") — a real
 * list-grouped-by-`scheduledAt`-date view of every `SCHEDULED` post, rather than the spec's
 * full month-grid mockup. A custom calendar grid (week/month navigation, per-cell event chips,
 * click-to-preview modal) is real UI surface this pass can't build AND fully verify with Vitest +
 * RTL in the time available — per the coordinator note's own explicit allowance ("a simpler real
 * list-grouped-by-date view is an acceptable, honestly-scoped substitute — document the choice,
 * don't fabricate a fancier UI than you can verify works"). Every post shown here is real (the
 * same `GET /api/v1/sosmed/posts?status=SCHEDULED` Post Manager's "Terjadwal" tab uses); platform
 * color-coding matches the spec's literal hex table via `PLATFORM_COLOR`, resolved through the
 * post's `accountId` -> the matching real `GET /api/v1/sosmed/accounts` row.
 */
export function ContentCalendarClient(): React.ReactElement {
  const [posts, setPosts] = useState<readonly ScheduledPostDto[] | undefined>(undefined);
  const [accounts, setAccounts] = useState<readonly SosmedAccountDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/sosmed/posts?status=SCHEDULED").then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat jadwal konten.");
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
        setError(caught instanceof Error ? caught.message : "Gagal memuat Content Calendar.");
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

  const accountById = new Map(accounts.map((a) => [a.id, a] as const));
  const sorted = [...posts]
    .filter((p) => p.scheduledAt !== undefined)
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));

  const groups = new Map<string, ScheduledPostDto[]>();
  for (const post of sorted) {
    const dateKey = formatDateId(post.scheduledAt as string);
    const group = groups.get(dateKey);
    if (group !== undefined) {
      group.push(post);
    } else {
      groups.set(dateKey, [post]);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>Content Calendar</h2>
          <p className={styles.subtitle}>Jadwal konten sosmed, dikelompokkan per tanggal</p>
        </div>
        <Link href="/sosmed/studio" className={styles.primaryButton}>
          + Buat Konten
        </Link>
      </div>

      {groups.size === 0 ? (
        <EmptyState title="Belum ada konten terjadwal" icon="📅" />
      ) : (
        <div data-testid="calendar-groups">
          {Array.from(groups.entries()).map(([dateKey, groupPosts]) => (
            <div key={dateKey} className={styles.dateGroup}>
              <p className={styles.dateGroupHeading}>{dateKey}</p>
              <div className={styles.rowList}>
                {groupPosts.map((post) => {
                  const account =
                    post.accountId !== undefined ? accountById.get(post.accountId) : undefined;
                  return (
                    <div key={post.id} className={styles.row}>
                      <div className={styles.rowMeta}>
                        <p className={styles.rowTitle}>
                          {account !== undefined ? (
                            <span
                              className={styles.platformBadge}
                              style={{ background: PLATFORM_COLOR[account.platform] }}
                            >
                              {PLATFORM_LABEL[account.platform]}
                            </span>
                          ) : null}{" "}
                          {post.scheduledAt !== undefined
                            ? formatDateTimeIdWib(post.scheduledAt)
                            : "—"}
                        </p>
                        <p className={styles.rowDetail}>
                          {post.caption.slice(0, 70)}
                          {post.caption.length > 70 ? "…" : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
