import styles from "./DateRangeSelector.module.css";

const DATE_PRESETS = [
  { value: "last_7d", label: "7 hari terakhir" },
  { value: "last_14d", label: "14 hari terakhir" },
  { value: "last_30d", label: "30 hari terakhir" },
] as const;

export interface DateRangeSelectorProps {
  readonly value: string;
  readonly onChange: (datePreset: string) => void;
}

/**
 * Date-range preset dropdown (spec "components/meta-ads/DateRangeSelector.tsx" — mockup
 * "[Dari: 01/08] [Sampai: 31/08]"; implemented as `aaos-api`'s real `datePreset` enum rather than
 * free-text dates, since that's the parameter `GET /api/v1/campaigns` actually accepts — the
 * TOTAL UI REBUILD spec's own "=== TOOLBAR === Date inputs" slot has no corresponding backend
 * query capability either, the same judgment call made three times before this session for the
 * MAAO2/Samantha-pages/UI-overhaul tasks). This restyles the EXISTING preset control into the new
 * toolbar's "Date inputs" visual slot (spec: "Same style as snapshot selector") rather than adding
 * non-functional free-text date pickers.
 */
export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps): React.ReactElement {
  return (
    <label className={styles.wrap}>
      Periode
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={styles.select}
      >
        {DATE_PRESETS.map((preset) => (
          <option key={preset.value} value={preset.value}>
            {preset.label}
          </option>
        ))}
      </select>
    </label>
  );
}
