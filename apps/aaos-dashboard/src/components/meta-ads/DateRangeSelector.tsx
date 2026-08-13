const DATE_PRESETS = [
  { value: "last_7d", label: "7 hari terakhir" },
  { value: "last_14d", label: "14 hari terakhir" },
  { value: "last_30d", label: "30 hari terakhir" },
] as const;

export interface DateRangeSelectorProps {
  readonly value: string;
  readonly onChange: (datePreset: string) => void;
}

/** Date-range preset dropdown (spec "components/meta-ads/DateRangeSelector.tsx" — mockup "[Dari: 01/08] [Sampai: 31/08]"; implemented as `aaos-api`'s real `datePreset` enum rather than free-text dates, since that's the parameter `GET /api/v1/campaigns` actually accepts). */
export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps): React.ReactElement {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      Periode
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-button border border-hairline bg-surface-card px-2 py-1"
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
