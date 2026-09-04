import styles from "./AdAccountSelector.module.css";

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
    <label className={styles.wrap}>
      Ad Account
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={styles.select}
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
