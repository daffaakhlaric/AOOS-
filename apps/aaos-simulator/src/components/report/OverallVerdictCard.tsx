import { formatOverallScore } from "@/lib/formatters";
import type { AllScenariosReportDto } from "@/types/simulator.types";

import { VerdictBadge } from "../simulator/VerdictBadge";

export interface OverallVerdictCardProps {
  readonly report: AllScenariosReportDto;
}

/** Overall verdict + avg score summary card (spec "components/report/OverallVerdictCard.tsx", mockup: "Overall Verdict: APPROVE ✅  Avg Score: 82/100"). */
export function OverallVerdictCard({ report }: OverallVerdictCardProps): React.ReactElement {
  return (
    <div
      data-testid="overall-verdict-card"
      className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-hairline bg-surface-card p-4 shadow-card"
    >
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-ink-muted">Overall Verdict</span>
        <VerdictBadge verdict={report.overallVerdict} />
      </div>
      <div className="text-right">
        <p className="text-xs uppercase tracking-wide text-ink-muted">Avg Score</p>
        <p data-testid="avg-overall-score" className="text-xl font-semibold text-ink">
          {formatOverallScore(report.avgOverallScore)}/100
        </p>
      </div>
    </div>
  );
}
