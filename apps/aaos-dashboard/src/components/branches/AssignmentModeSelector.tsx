import styles from "./AssignmentModeSelector.module.css";

export type AssignmentMode = "SMART_ASSIGN" | "ROUND_ROBIN" | "MANUAL";

const MODES: ReadonlyArray<{ readonly value: AssignmentMode; readonly label: string }> = [
  { value: "SMART_ASSIGN", label: "Smart Assign" },
  { value: "ROUND_ROBIN", label: "Round Robin" },
  { value: "MANUAL", label: "Manual" },
];

export interface AssignmentModeSelectorProps {
  readonly value: AssignmentMode;
  readonly onChange: (mode: AssignmentMode) => void;
}

/** SMART_ASSIGN | ROUND_ROBIN | MANUAL radio selector (spec "components/branches/AssignmentModeSelector.tsx"). */
export function AssignmentModeSelector({
  value,
  onChange,
}: AssignmentModeSelectorProps): React.ReactElement {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Assignment Mode</legend>
      {MODES.map((mode) => (
        <label key={mode.value} className={styles.option}>
          <input
            type="radio"
            name="assignment-mode"
            checked={value === mode.value}
            onChange={() => onChange(mode.value)}
          />
          {mode.label}
        </label>
      ))}
    </fieldset>
  );
}
