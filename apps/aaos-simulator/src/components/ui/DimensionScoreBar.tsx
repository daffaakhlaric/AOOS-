import {
  dimensionScoreColorClass,
  formatDimensionScore,
  isNotApplicableDimension,
} from "@/lib/formatters";
import type { DimensionScoreDto } from "@/types/simulator.types";

export interface DimensionScoreBarProps {
  readonly label: string;
  readonly score: DimensionScoreDto;
}

/** A 0-10 bar with color (spec "components/ui/DimensionScoreBar.tsx"): green >= 8, amber 5-7, red < 5, "N/A" for skipped dimensions. */
export function DimensionScoreBar({ label, score }: DimensionScoreBarProps): React.ReactElement {
  const notApplicable = isNotApplicableDimension(score);
  const widthPercent = Math.max(0, Math.min(100, (score.score / 10) * 100));

  return (
    <div data-testid="dimension-score-bar" className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="text-ink-muted" data-testid="dimension-score-value">
          {notApplicable ? "N/A" : `${formatDimensionScore(score.score)}/10`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-hairline">
        {notApplicable ? (
          <div className="h-full w-full bg-hairline" />
        ) : (
          <div
            data-testid="dimension-score-fill"
            className={`h-full rounded-full ${dimensionScoreColorClass(score.score)}`}
            style={{ width: `${widthPercent}%` }}
          />
        )}
      </div>
    </div>
  );
}
