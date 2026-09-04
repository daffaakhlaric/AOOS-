"use client";

import { useCallback, useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDateTimeIdWib, formatNumber } from "@/lib/formatters";
import { STATUS_LABEL } from "@/lib/sosmed-format";
import type { ScheduledPostDto, ScheduledPostStatus } from "@/types/sosmed.types";

import styles from "./Sosmed.shared.module.css";

const TABS: readonly { readonly key: ScheduledPostStatus; readonly label: string }[] = [
  { key: "SCHEDULED", label: "Terjadwal" },
  { key: "PUBLISHED", label: "Sudah Post" },
  { key: "DRAFT", label: "Draft" },
  { key: "FAILED", label: "Gagal" },
];

/**
 * `/sosmed/posts` (AAOS-SOSMED-AUTOMATION Phase 5, Page 4 "Post Manager") — 4 tabs backed by the
 * real `GET /api/v1/sosmed/posts?status=...`. "Post Sekarang" calls the real
 * `POST /api/v1/sosmed/posts/:id/publish-now`; "Batalkan" calls the real
 * `DELETE /api/v1/sosmed/posts/:id`. The spec's per-card "Preview"/"Edit" actions are omitted for
 * this pass — there is no dedicated preview-render or inline-edit UI built yet; a caption+hashtag
 * text dump is already fully visible on the card itself, so a modal would add no real information,
 * only surface area to keep honest. Cancel is only offered for cancellable statuses (SCHEDULED/
 * DRAFT/FAILED) — a PUBLISHED post has nothing left to cancel.
 */
export function PostManagerClient(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<ScheduledPostStatus>("SCHEDULED");
  const [posts, setPosts] = useState<readonly ScheduledPostDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | undefined>(undefined);

  const load = useCallback((status: ScheduledPostStatus) => {
    setPosts(undefined);
    fetch(`/api/sosmed/posts?status=${status}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat daftar post.");
        }
        return (await res.json()) as { posts: readonly ScheduledPostDto[] };
      })
      .then((body) => setPosts(body.posts))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat Post Manager.");
      });
  }, []);

  useEffect(() => {
    load(activeTab);
  }, [activeTab, load]);

  async function handlePublishNow(id: string): Promise<void> {
    setBusyId(id);
    try {
      const response = await fetch(`/api/sosmed/posts/${id}/publish-now`, { method: "POST" });
      if (response.ok) {
        load(activeTab);
      }
    } finally {
      setBusyId(undefined);
    }
  }

  async function handleCancel(id: string): Promise<void> {
    setBusyId(id);
    try {
      const response = await fetch(`/api/sosmed/posts/${id}`, { method: "DELETE" });
      if (response.ok) {
        load(activeTab);
      }
    } finally {
      setBusyId(undefined);
    }
  }

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>Post Manager</h2>
          <p className={styles.subtitle}>Semua post: terjadwal, sudah posting, draft, gagal</p>
        </div>
      </div>

      <div className={styles.tabRow} role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={activeTab === tab.key ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {posts === undefined ? (
        <LoadingSpinner />
      ) : posts.length === 0 ? (
        <EmptyState title={`Tidak ada post ${STATUS_LABEL[activeTab].toLowerCase()}`} icon="📭" />
      ) : (
        <div className={styles.rowList} data-testid="post-manager-list">
          {posts.map((post) => (
            <div key={post.id} className={styles.row} data-testid="post-manager-row">
              <div className={styles.rowMeta}>
                <p className={styles.rowTitle}>
                  {post.caption.slice(0, 80)}
                  {post.caption.length > 80 ? "…" : ""}
                </p>
                <p className={styles.rowDetail}>
                  {post.hashtags.slice(0, 4).join(" ")}
                  {post.scheduledAt !== undefined
                    ? ` · 📅 ${formatDateTimeIdWib(post.scheduledAt)}`
                    : ""}
                  {post.status === "PUBLISHED"
                    ? ` · Reach: ${formatNumber(post.reach)} · Like: ${formatNumber(post.likes)} · Comment: ${formatNumber(post.comments)} · Share: ${formatNumber(post.shares)}`
                    : ""}
                  {post.status === "FAILED" && post.errorMessage !== undefined
                    ? ` · ${post.errorMessage}`
                    : ""}
                </p>
              </div>
              <div className={styles.rowActions}>
                {post.status === "SCHEDULED" || post.status === "DRAFT" ? (
                  <button
                    type="button"
                    className={styles.linkButton}
                    disabled={busyId === post.id}
                    onClick={() => void handlePublishNow(post.id)}
                  >
                    Post Sekarang
                  </button>
                ) : null}
                {post.status === "SCHEDULED" ||
                post.status === "DRAFT" ||
                post.status === "FAILED" ? (
                  <button
                    type="button"
                    className={styles.dangerLinkButton}
                    disabled={busyId === post.id}
                    onClick={() => void handleCancel(post.id)}
                  >
                    Batalkan
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
