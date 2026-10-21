import type { StressTestEvaluatedResultDto } from "@/lib/stress-test";
import { buildPriorityList } from "@/lib/stress-test-result";
import { EvidenceBadge } from "./EvidenceBadge";
import styles from "./result.module.css";

const SEVERITY_TEXT: Record<number, string> = { 3: "Tinggi", 2: "Sedang", 1: "Rendah" };

/** Samantha's primary recommendation (backend `primaryRecommendation`, verbatim) + a deterministic
 * priority list built from real findings only (`buildPriorityList`). */
export function PrimaryRecommendationPanel({
  result,
}: {
  readonly result: StressTestEvaluatedResultDto;
}): React.ReactElement {
  const items = buildPriorityList(result);
  return (
    <section className={styles.recommendation} data-testid="stress-test-recommendation-panel">
      <h2>Rekomendasi Utama Samantha</h2>
      <p className={styles.recommendationHeadline} data-testid="stress-test-primary-recommendation">
        {result.primaryRecommendation}
      </p>
      {items.length > 0 ? (
        <>
          <span className={styles.sectionLabel}>Urutan prioritas perbaikan</span>
          <ol className={styles.priorityList} data-testid="stress-test-priority-list">
            {items.map((item, i) => (
              <li key={item.id} data-testid="stress-test-priority-item">
                <span className={styles.priorityIndex}>{i + 1}</span>
                <div>
                  <div className={styles.priorityTitle}>
                    <span>{item.title}</span>
                    {item.evidence !== undefined ? <EvidenceBadge kind={item.evidence} /> : null}
                  </div>
                  <div className={styles.muted}>
                    {item.detail} · Prioritas {SEVERITY_TEXT[item.severityRank] ?? "—"}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <p className={styles.note}>
            Diurutkan otomatis dari temuan nyata run ini: tingkat keparahan, jumlah persona simulasi
            yang mengangkatnya, lalu skor dimensi terendah. Tanpa AI tambahan.
          </p>
        </>
      ) : (
        <p className={styles.muted}>
          Tidak ada temuan lain yang perlu diprioritaskan pada run ini.
        </p>
      )}
    </section>
  );
}
