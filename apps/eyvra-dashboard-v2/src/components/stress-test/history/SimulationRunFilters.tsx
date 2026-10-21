import {
  MODE_LABELS,
  SCORE_BUCKET_LABELS,
  STATUS_LABELS,
  type StressTestMode,
  type StressTestScoreBucket,
  type StressTestSourceType,
  type StressTestStatus,
} from "@/lib/stress-test";
import {
  DEFAULT_HISTORY_FILTERS,
  HISTORY_CHIPS,
  SOURCE_TYPE_LABELS,
  type HistorySort,
  type SimulationHistoryFilters,
} from "@/lib/stress-test-history";
import styles from "./history.module.css";

const SORT_LABELS: Record<HistorySort, string> = {
  NEWEST: "Terbaru",
  OLDEST: "Terlama",
  SCORE_DESC: "Skor tertinggi",
  SCORE_ASC: "Skor terendah",
};

function entries<K extends string>(record: Record<K, string>): readonly [K, string][] {
  return Object.entries(record) as [K, string][];
}

export function SimulationRunFilters({
  filters,
  onChange,
}: {
  readonly filters: SimulationHistoryFilters;
  readonly onChange: (next: SimulationHistoryFilters) => void;
}): React.ReactElement {
  // Any filter change returns to page 1.
  const set = (patch: Partial<SimulationHistoryFilters>): void =>
    onChange({ ...filters, ...patch, page: 1 });
  const dirty =
    JSON.stringify({ ...filters, page: 1, pageSize: 25 }) !==
    JSON.stringify({ ...DEFAULT_HISTORY_FILTERS, pageSize: 25 });

  return (
    <div className={styles.filters} data-testid="simulation-run-filters">
      <div className={styles.chips} role="group" aria-label="Filter cepat">
        {HISTORY_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`${styles.chip} ${filters.chip === chip.id ? styles.chipActive : ""}`}
            aria-pressed={filters.chip === chip.id}
            title={chip.title}
            onClick={() => set({ chip: chip.id })}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <div className={styles.filterRow}>
        <label className={`${styles.field} ${styles.search}`}>
          Cari
          <input
            type="search"
            className={styles.input}
            placeholder="Nama run atau judul konteks…"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
          />
        </label>
        <label className={styles.field}>
          Status
          <select
            className={styles.select}
            value={filters.status}
            onChange={(e) => set({ status: e.target.value as "ALL" | StressTestStatus })}
          >
            <option value="ALL">Semua status</option>
            {entries(STATUS_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Mode
          <select
            className={styles.select}
            value={filters.mode}
            onChange={(e) => set({ mode: e.target.value as "ALL" | StressTestMode })}
          >
            <option value="ALL">Semua mode</option>
            {entries(MODE_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Readiness
          <select
            className={styles.select}
            value={filters.readiness}
            onChange={(e) =>
              set({ readiness: e.target.value as SimulationHistoryFilters["readiness"] })
            }
          >
            <option value="ALL">Semua readiness</option>
            {entries(SCORE_BUCKET_LABELS).map(([id, label]) => (
              <option key={id} value={id as StressTestScoreBucket}>
                {label}
              </option>
            ))}
            <option value="NONE">Belum ada hasil</option>
          </select>
        </label>
        <label className={styles.field}>
          Konteks
          <select
            className={styles.select}
            value={filters.contextType}
            onChange={(e) => set({ contextType: e.target.value as "ALL" | StressTestSourceType })}
          >
            <option value="ALL">Semua konteks</option>
            {entries(SOURCE_TYPE_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Dari
          <input
            type="date"
            className={styles.input}
            value={filters.dateFrom}
            onChange={(e) => set({ dateFrom: e.target.value })}
          />
        </label>
        <label className={styles.field}>
          Sampai
          <input
            type="date"
            className={styles.input}
            value={filters.dateTo}
            onChange={(e) => set({ dateTo: e.target.value })}
          />
        </label>
        <label className={styles.field}>
          Urutkan
          <select
            className={styles.select}
            value={filters.sort}
            onChange={(e) => set({ sort: e.target.value as HistorySort })}
          >
            {entries(SORT_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {dirty ? (
          <button
            type="button"
            className={styles.resetButton}
            onClick={() => onChange({ ...DEFAULT_HISTORY_FILTERS, pageSize: filters.pageSize })}
          >
            Reset filter
          </button>
        ) : null}
      </div>
    </div>
  );
}
