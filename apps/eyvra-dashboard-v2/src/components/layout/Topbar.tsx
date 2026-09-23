"use client";

import { useEffect, useState } from "react";

import { PendingApprovalDrawer, usePendingActionsCount } from "./PendingApprovalDrawer";
import { presentLabel } from "@/lib/presentation";
import type { GrowthObjectiveListResponseDto } from "@/types/dashboard.types";
import { NavIcon } from "./NavIcon";
import styles from "./Topbar.module.css";

export function Topbar({
  title,
  subtitle,
  lastSyncIso,
  userEmail,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly lastSyncIso?: string;
  readonly userEmail?: string;
}): React.ReactElement {
  const [mode, setMode] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    fetch("/api/growth-objectives")
      .then(async (response) =>
        response.ok ? ((await response.json()) as GrowthObjectiveListResponseDto) : undefined,
      )
      .then((body) => {
        const current = body?.objectives
          .filter((item) =>
            ["ACTIVE", "ON_TRACK", "AT_RISK", "OFF_TRACK", "REPLANNING"].includes(item.status),
          )
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        if (!cancelled && current) setMode(presentLabel(current.automationMode));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { count, failed } = usePendingActionsCount();

  const lastSyncLabel =
    lastSyncIso !== undefined
      ? new Intl.DateTimeFormat("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Jakarta",
        }).format(new Date(lastSyncIso))
      : undefined;

  return (
    <>
      <header className={styles.bar}>
        <div>
          <p className={styles.greeting}>
            Welcome back{userEmail ? `, ${userEmail.split("@")[0]}` : ""} 👋
          </p>
          <h1 className={styles.title}>{title}</h1>
          {subtitle !== undefined ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        <div className={styles.actions}>
          <span
            className={styles.period}
            title="Campaign metrics use the backend’s last 7 days; CRM counts show current totals."
          >
            Last 7 Days
          </span>
          <span className={styles.mode}>
            <span aria-hidden="true">●</span> {mode ?? "Automation unavailable"}
          </span>
          {lastSyncLabel !== undefined ? (
            <span className={styles.syncTime} title="Waktu sinkronisasi data terakhir">
              <NavIcon name="clock" size={14} />
              Sync {lastSyncLabel} WIB
            </span>
          ) : null}
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setDrawerOpen(true)}
            aria-label="Pending Approvals"
            data-testid="pending-approvals-trigger"
          >
            <NavIcon name="check" size={16} />
            {!failed && count !== undefined && count > 0 ? (
              <span className={styles.badge}>{count}</span>
            ) : null}
          </button>
          <button type="button" className={styles.iconButton} aria-label="Notifikasi" disabled>
            <NavIcon name="bell" size={16} />
          </button>
          {userEmail !== undefined ? (
            <span className={styles.userChip} title={userEmail}>
              <span className={styles.avatar}>{userEmail.slice(0, 2).toUpperCase()}</span>
              {userEmail.split("@")[0]}
            </span>
          ) : null}
        </div>
      </header>
      <PendingApprovalDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
