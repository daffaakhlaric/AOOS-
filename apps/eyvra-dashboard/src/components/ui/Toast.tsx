"use client";

import { useEffect } from "react";

import styles from "./Toast.module.css";

export type ToastVariant = "success" | "error" | "info";

export interface ToastProps {
  readonly message: string;
  readonly variant?: ToastVariant;
  /** Called once the toast should be removed — either the auto-dismiss timer fired, or a caller-driven dismiss. */
  readonly onDismiss: () => void;
  /** Auto-dismiss delay in ms (FINAL UI REBUILD spec "GLOBAL: TOAST NOTIFICATIONS" — "auto-dismiss 3 detik"). */
  readonly durationMs?: number;
}

const DEFAULT_DURATION_MS = 3000;

const VARIANT_ICON: Readonly<Record<ToastVariant, string>> = {
  success: "✓",
  error: "⚠",
  info: "ℹ",
};

const VARIANT_CLASS: Readonly<Record<ToastVariant, string>> = {
  success: styles.success ?? "",
  error: styles.error ?? "",
  info: styles.info ?? "",
};

/**
 * Top-right, auto-dismissing toast notification (spec "GLOBAL: TOAST NOTIFICATIONS" — new
 * primitive, no existing component covered this; coordinator note #7). A page owns the toast's
 * lifecycle (message/variant state + a list of active toasts) and renders one `<Toast>` per active
 * entry; this component only renders its own bubble and calls `onDismiss` when its timer elapses,
 * it does not manage a global queue itself (keeping it a plain, stateless-between-renders
 * presentational primitive per this app's existing `components/ui/*` pattern).
 */
export function Toast({
  message,
  variant = "info",
  onDismiss,
  durationMs = DEFAULT_DURATION_MS,
}: ToastProps): React.ReactElement {
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [onDismiss, durationMs]);

  return (
    <div role="status" aria-live="polite" className={`${styles.toast} ${VARIANT_CLASS[variant]}`}>
      <span aria-hidden="true">{VARIANT_ICON[variant]}</span>
      <span>{message}</span>
    </div>
  );
}
