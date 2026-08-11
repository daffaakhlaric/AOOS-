export interface RunButtonProps {
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly isRunning?: boolean;
  readonly label?: string;
}

/** Triggers a simulation run (spec "components/simulator/RunButton.tsx"). */
export function RunButton({
  onClick,
  disabled = false,
  isRunning = false,
  label = "Jalankan",
}: RunButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      data-testid="run-button"
      onClick={onClick}
      disabled={disabled || isRunning}
      className="w-full rounded-button bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isRunning ? "Menjalankan..." : `▶ ${label}`}
    </button>
  );
}
