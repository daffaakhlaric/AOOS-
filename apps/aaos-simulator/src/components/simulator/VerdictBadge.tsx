import type { Verdict } from "@aos/ai-judge";

import { verdictColorClasses, verdictEmoji, verdictLabel } from "@/lib/formatters";

export interface VerdictBadgeProps {
  readonly verdict: Verdict;
}

/** APPROVE ✅ / NEEDS_IMPROVEMENT ⚠️ / FAIL ❌ (spec "components/simulator/VerdictBadge.tsx"). */
export function VerdictBadge({ verdict }: VerdictBadgeProps): React.ReactElement {
  return (
    <span
      data-testid="verdict-badge"
      data-verdict={verdict}
      className={`inline-flex items-center gap-1.5 rounded-button border px-3 py-1 text-sm font-semibold ${verdictColorClasses(verdict)}`}
    >
      <span aria-hidden="true">{verdictEmoji(verdict)}</span>
      {verdictLabel(verdict)}
    </span>
  );
}
