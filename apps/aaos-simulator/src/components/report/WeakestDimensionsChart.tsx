import { dimensionScoreColorClass, formatDimensionScore } from "@/lib/formatters";
import type { AllScenariosReportDto } from "@/types/simulator.types";

export interface WeakestDimensionsChartProps {
  readonly weakestDimensions: AllScenariosReportDto["weakestDimensions"];
}

const DIMENSION_LABELS: Readonly<Record<string, string>> = {
  NATURAL_LANGUAGE: "Natural Language",
  QUALIFICATION: "Qualification",
  OBJECTION_HANDLING: "Objection Handling",
  CLOSING_ATTEMPT: "Closing Attempt",
  HANDOFF_QUALITY: "Handoff Quality",
  RESPONSE_LENGTH: "Response Length",
};

/** Bar chart of weakest areas (spec "components/report/WeakestDimensionsChart.tsx", mockup "📉 Dimensi Terlemah"). */
export function WeakestDimensionsChart({
  weakestDimensions,
}: WeakestDimensionsChartProps): React.ReactElement {
  return (
    <div data-testid="weakest-dimensions-chart" className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-ink">📉 Dimensi Terlemah</h2>
      <div className="flex flex-col gap-2">
        {weakestDimensions.map((dimension) => (
          <div
            key={dimension.dimension}
            className="flex flex-col gap-1"
            data-testid="weakest-dimension-row"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink">
                {DIMENSION_LABELS[dimension.dimension] ?? dimension.dimension}
              </span>
              <span className="text-ink-muted">{formatDimensionScore(dimension.avgScore)}/10</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-hairline">
              <div
                className={`h-full rounded-full ${dimensionScoreColorClass(dimension.avgScore)}`}
                style={{ width: `${Math.max(0, Math.min(100, (dimension.avgScore / 10) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
