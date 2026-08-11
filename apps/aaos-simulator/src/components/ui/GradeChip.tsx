import type { Grade } from "@aos/ai-judge";

/**
 * Keyed with `Grade`'s plain string values ("A", "B+", "B", "C", "F"), not `[Grade.A]` computed
 * keys — this file only ever `import type`s `Grade` (client-bundling boundary, design resolution
 * #5: importing `@aos/ai-judge` as a runtime value here would pull its whole Node-only dependency
 * graph — `@aos/logger`/`@aos/telemetry`'s `node:crypto`/`node:async_hooks` usage — into the
 * client bundle, since `GradeChip` renders inside `SimulatorClient`'s `"use client"` tree).
 */
const GRADE_CLASSES: Readonly<Record<Grade, string>> = {
  A: "bg-brand-success/10 text-brand-success",
  "B+": "bg-brand-success/10 text-brand-success",
  B: "bg-brand-warning/10 text-brand-warning",
  C: "bg-brand-warning/10 text-brand-warning",
  F: "bg-brand-danger/10 text-brand-danger",
};

/** A/B+/B/C/F colored chip (spec "components/ui/GradeChip.tsx"). */
export function GradeChip({ grade }: { readonly grade: Grade }): React.ReactElement {
  return (
    <span
      data-testid="grade-chip"
      className={`inline-flex items-center rounded-button px-2 py-0.5 text-sm font-semibold ${GRADE_CLASSES[grade]}`}
    >
      {grade}
    </span>
  );
}
