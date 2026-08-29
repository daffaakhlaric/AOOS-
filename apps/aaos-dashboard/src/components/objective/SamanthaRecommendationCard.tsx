import styles from "./SamanthaRecommendationCard.module.css";

export interface SamanthaRecommendationData {
  readonly summary: string;
  readonly actions: readonly string[];
}

export interface SamanthaRecommendationCardProps {
  readonly data: SamanthaRecommendationData;
  readonly onUseRecommendation?: () => void;
}

/**
 * Samantha's recommended action plan (spec "objective/page.tsx" mockup: "Berdasarkan data Juli...
 * Scale: #C047, #C048, #C051 / Pause: 16 iklan boros..."). No `aaos-api` endpoint currently backs
 * `GenerateRecommendation` (out of AAOS-W4A's 7-endpoint scope — see `README.md`'s "Known
 * limitations"), so this is a presentational component only; wiring `POST
 * /api/v1/objective/recommend` is follow-up work.
 */
export function SamanthaRecommendationCard({
  data,
  onUseRecommendation,
}: SamanthaRecommendationCardProps): React.ReactElement {
  return (
    <section data-testid="samantha-recommendation-card" className={styles.section}>
      <p className={styles.title}>💡 Rekomendasi Samantha</p>
      <p className={styles.summary}>{data.summary}</p>
      <ul className={styles.actions}>
        {data.actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
      <button type="button" onClick={onUseRecommendation} className={styles.button}>
        Pakai Rekomendasi Ini
      </button>
    </section>
  );
}
