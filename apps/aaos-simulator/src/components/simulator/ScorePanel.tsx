import { formatOverallScore } from "@/lib/formatters";
import type { JudgementResultDto } from "@/types/simulator.types";

import { DimensionScoreBar } from "../ui/DimensionScoreBar";
import { GradeChip } from "../ui/GradeChip";

import { VerdictBadge } from "./VerdictBadge";

export interface ScorePanelProps {
  readonly judgementResult: JudgementResultDto | undefined;
}

const DIMENSION_ROWS: ReadonlyArray<{
  readonly key: keyof Pick<
    JudgementResultDto,
    | "naturalLanguage"
    | "qualification"
    | "objectionHandling"
    | "closingAttempt"
    | "handoffQuality"
    | "responseLength"
  >;
  readonly label: string;
}> = [
  { key: "naturalLanguage", label: "Natural Language" },
  { key: "qualification", label: "Qualification" },
  { key: "objectionHandling", label: "Objection Handling" },
  { key: "closingAttempt", label: "Closing Attempt" },
  { key: "handoffQuality", label: "Handoff Quality" },
  { key: "responseLength", label: "Response Length" },
];

/** 6 dimension scores + overall grade/verdict (spec "components/simulator/ScorePanel.tsx"). */
export function ScorePanel({ judgementResult }: ScorePanelProps): React.ReactElement {
  if (!judgementResult) {
    return (
      <div
        data-testid="score-panel-empty"
        className="flex h-full min-h-[200px] items-center justify-center rounded-card border border-dashed border-hairline p-6 text-center text-sm text-ink-muted"
      >
        Belum ada hasil
      </div>
    );
  }

  return (
    <div data-testid="score-panel" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted">Overall</p>
          <p data-testid="overall-score" className="text-2xl font-semibold text-ink">
            {formatOverallScore(judgementResult.overallScore)}/100
          </p>
        </div>
        <GradeChip grade={judgementResult.grade} />
      </div>

      <div className="flex flex-col gap-3">
        {DIMENSION_ROWS.map((row) => (
          <DimensionScoreBar key={row.key} label={row.label} score={judgementResult[row.key]} />
        ))}
      </div>

      <div className="border-t border-hairline pt-3">
        <VerdictBadge verdict={judgementResult.verdict} />
      </div>
    </div>
  );
}
