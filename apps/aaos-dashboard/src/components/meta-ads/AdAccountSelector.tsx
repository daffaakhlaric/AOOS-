export interface AdAccountSelectorProps {
  readonly value: string;
  readonly options: readonly { readonly id: string; readonly name: string }[];
  readonly onChange: (adAccountId: string) => void;
}

/** Ad account dropdown (spec "components/meta-ads/AdAccountSelector.tsx"). */
export function AdAccountSelector({
  value,
  options,
  onChange,
}: AdAccountSelectorProps): React.ReactElement {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      Ad Account
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-button border border-hairline bg-surface-card px-2 py-1"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
