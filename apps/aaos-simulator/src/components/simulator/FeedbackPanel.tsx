import type { JudgementResultDto } from "@/types/simulator.types";

export interface FeedbackPanelProps {
  readonly judgementResult: JudgementResultDto | undefined;
}

/** Specific feedback items — "Yang bagus" (highlights) / "Yang perlu diperbaiki" (feedbackItems) (spec "Feedback Panel"). */
export function FeedbackPanel({ judgementResult }: FeedbackPanelProps): React.ReactElement | null {
  if (!judgementResult) {
    return null;
  }

  const hasHighlights = judgementResult.highlights.length > 0;
  const hasFeedback = judgementResult.feedbackItems.length > 0;

  if (!hasHighlights && !hasFeedback) {
    return null;
  }

  return (
    <section
      data-testid="feedback-panel"
      className="flex flex-col gap-3 rounded-card border border-hairline bg-surface-card p-4 shadow-card"
    >
      <h2 className="text-sm font-semibold text-ink">📋 Feedback Detail</h2>

      {hasHighlights && (
        <div>
          <p className="text-sm font-medium text-brand-success">✅ Yang bagus:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink">
            {judgementResult.highlights.map((highlight, index) => (
              <li key={index}>{highlight}</li>
            ))}
          </ul>
        </div>
      )}

      {hasFeedback && (
        <div>
          <p className="text-sm font-medium text-brand-warning">⚠️ Yang perlu diperbaiki:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink">
            {judgementResult.feedbackItems.map((item, index) => (
              <li key={index}>{item.message}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
