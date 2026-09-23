"use client";

import { useEffect, useState } from "react";

import { Drawer } from "@/components/common/Drawer";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { formatDateId } from "@/lib/formatters";
import type { PendingActionDto } from "@/types/dashboard.types";

import styles from "./PendingApprovalDrawer.module.css";

export function usePendingActionsCount(): { count?: number; failed: boolean } {
  const [count, setCount] = useState<number | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pending-actions?status=PENDING")
      .then((res) =>
        res.ok ? (res.json() as Promise<{ actions: readonly PendingActionDto[] }>) : null,
      )
      .then((body) => {
        if (!cancelled) {
          if (body === null) {
            setFailed(true);
          } else {
            setCount(body.actions.length);
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

  return { count, failed };
}

export function PendingApprovalDrawer({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}): React.ReactElement {
  const [actions, setActions] = useState<readonly PendingActionDto[] | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    fetch("/api/pending-actions?status=PENDING")
      .then((res) =>
        res.ok ? (res.json() as Promise<{ actions: readonly PendingActionDto[] }>) : null,
      )
      .then((body) => {
        if (!cancelled) {
          if (body === null) {
            setFailed(true);
          } else {
            setActions(body.actions);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <Drawer open={open} onClose={onClose} title="Pending Approvals">
      {failed ? (
        <ErrorState message="Tidak bisa memuat daftar persetujuan tertunda saat ini." />
      ) : actions === undefined ? (
        <LoadingState />
      ) : actions.length === 0 ? (
        <EmptyState
          title="Tidak ada aksi yang menunggu persetujuan"
          description="Setiap keputusan Samantha/Kai/Clara yang memerlukan approval akan muncul di sini."
        />
      ) : (
        <ul className={styles.list} data-testid="pending-approvals-list">
          {actions.map((action) => (
            <li key={action.id} className={styles.row}>
              <p className={styles.actionType}>{action.actionType.replaceAll("_", " ")}</p>
              <p className={styles.meta}>
                {action.agent} · {formatDateId(action.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
