import type { Verdict } from "@aos/ai-judge";

import type { DimensionScoreDto } from "../types/simulator.types";

/**
 * `Verdict`-keyed lookup tables, keyed by its plain string values ("APPROVE",
 * "NEEDS_IMPROVEMENT", "FAIL") rather than `Verdict.APPROVE` computed keys — this module only
 * ever `import type`s `Verdict` (client-bundling boundary, design resolution #5: these functions
 * run inside `SimulatorClient`/`ReportClient`'s `"use client"` tree via `VerdictBadge`, and
 * importing `@aos/ai-judge` as a runtime value would pull its whole Node-only dependency graph —
 * `@aos/logger`/`@aos/telemetry`'s `node:crypto`/`node:async_hooks` usage — into the client
 * bundle).
 */
const VERDICT_COLOR_CLASSES: Readonly<Record<Verdict, string>> = {
  APPROVE: "bg-brand-success/10 text-brand-success border-brand-success/30",
  NEEDS_IMPROVEMENT: "bg-brand-warning/10 text-brand-warning border-brand-warning/30",
  FAIL: "bg-brand-danger/10 text-brand-danger border-brand-danger/30",
};

const VERDICT_EMOJI: Readonly<Record<Verdict, string>> = {
  APPROVE: "✅",
  NEEDS_IMPROVEMENT: "⚠️",
  FAIL: "❌",
};

const VERDICT_LABELS: Readonly<Record<Verdict, string>> = {
  APPROVE: "APPROVE",
  NEEDS_IMPROVEMENT: "NEEDS_IMPROVEMENT",
  FAIL: "FAIL",
};

/**
 * `true` when a dimension's score is a structural default rather than an evaluated outcome — the
 * real `@aos/ai-judge` scorers (`ObjectionHandlingScorer`'s `NO_OBJECTION_PRESENT`,
 * `HandoffQualityScorer`'s `NO_HANDOFF_NEEDED`) apply exactly one rule and score a perfect 10 when
 * their dimension genuinely didn't come up in the conversation (no objection signal from the
 * buyer; lead never reached HOT, so no handoff was ever expected). `DimensionScoreValue` itself
 * has no null/"N/A" state — it's always a real `[0, 10]` number — so this reads the single-rule
 * shape those two scorers produce, the closest real, verifiable signal to the spec mockup's
 * "Objection N/A" cell.
 */
export function isNotApplicableDimension(score: DimensionScoreDto): boolean {
  return (
    score.appliedRules.length === 1 &&
    (score.appliedRules[0]?.rule === "NO_OBJECTION_PRESENT" ||
      score.appliedRules[0]?.rule === "NO_HANDOFF_NEEDED")
  );
}

/** Formats a rupiah amount as e.g. "Rp 195.000.000" — Indonesian thousands grouping, no decimals. */
export function formatIdr(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Formats a dimension score (0-10) to one decimal place, e.g. "8.5". */
export function formatDimensionScore(score: number): string {
  return score.toFixed(1);
}

/** Formats an overall score (0-100) as a whole number, e.g. "85". */
export function formatOverallScore(score: number): string {
  return Math.round(score).toString();
}

/** Formats a duration in milliseconds as e.g. "23 detik" (spec mockup: "5 turns, 23 detik"). */
export function formatDurationSeconds(durationMs: number): string {
  const seconds = Math.round(durationMs / 1000);
  return `${seconds} detik`;
}

/** Color token (Tailwind class) for a dimension bar (spec "Testing Requirements": green >= 8, amber 5-7, red < 5). */
export function dimensionScoreColorClass(score: number): string {
  if (score >= 8) {
    return "bg-brand-success";
  }
  if (score >= 5) {
    return "bg-brand-warning";
  }
  return "bg-brand-danger";
}

/** Color token (Tailwind classes) for a `Verdict` badge (spec "VerdictBadge.tsx"). */
export function verdictColorClasses(verdict: Verdict): string {
  return VERDICT_COLOR_CLASSES[verdict];
}

/** Emoji glyph for a `Verdict` (spec mockup: "APPROVE ✅ / NEEDS_IMPROVEMENT ⚠️ / FAIL ❌"). */
export function verdictEmoji(verdict: Verdict): string {
  return VERDICT_EMOJI[verdict];
}

/** Human-readable Indonesian label for a `Verdict`. */
export function verdictLabel(verdict: Verdict): string {
  return VERDICT_LABELS[verdict];
}
