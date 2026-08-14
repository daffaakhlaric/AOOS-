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
 * free-text dates, since that's the parameter `GET /api/v1/campaigns` actually accepts — the UI-
 * overhaul spec's "[Dari ____] [Sampai ____]" free-text inputs have no corresponding backend query
 * capability, the same judgment call made for the MAAO2/Tamara-pages tasks). This pass only
 * restyles the control to sit inline in the "Data Iklan" header strip alongside the snapshot
 * selector and the "Tarik Data Baru" button.
 */
export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps): React.ReactElement {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      Periode
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-button border border-hairline-card bg-surface-card px-2 py-1.5 text-sm"
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
