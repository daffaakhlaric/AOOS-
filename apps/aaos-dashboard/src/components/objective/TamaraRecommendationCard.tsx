export interface TamaraRecommendationData {
  readonly summary: string;
  readonly actions: readonly string[];
}

export interface TamaraRecommendationCardProps {
  readonly data: TamaraRecommendationData;
  readonly onUseRecommendation?: () => void;
}

/**
 * Tamara's recommended action plan (spec "objective/page.tsx" mockup: "Berdasarkan data Juli...
 * Scale: #C047, #C048, #C051 / Pause: 16 iklan boros..."). No `aaos-api` endpoint currently backs
 * `GenerateRecommendation` (out of AAOS-W4A's 7-endpoint scope — see `README.md`'s "Known
 * limitations"), so this is a presentational component only; wiring `POST
 * /api/v1/objective/recommend` is follow-up work.
 */
export function TamaraRecommendationCard({
  data,
  onUseRecommendation,
}: TamaraRecommendationCardProps): React.ReactElement {
  return (
    <section
      data-testid="tamara-recommendation-card"
      className="rounded-card border border-hairline bg-surface-card p-4 shadow-card"
    >
      <p className="text-sm font-semibold text-ink">💡 Rekomendasi Tamara</p>
      <p className="mt-1 text-sm text-ink-muted">{data.summary}</p>
      <ul className="mt-2 list-inside list-disc text-sm text-ink-muted">
        {data.actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onUseRecommendation}
        className="mt-3 rounded-button bg-brand-primary px-3 py-1.5 text-sm font-semibold text-white"
      >
        Pakai Rekomendasi Ini
      </button>
    </section>
  );
}
