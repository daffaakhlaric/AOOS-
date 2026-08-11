import type { PersonaDifficulty } from "@aos/conversation-simulator";

import type { PersonaSummary } from "@/types/simulator.types";

export interface PersonaSelectorProps {
  readonly personas: ReadonlyArray<PersonaSummary>;
  readonly selectedPersonaId: string | undefined;
  readonly onSelect: (personaId: string) => void;
}

const DIFFICULTY_CLASSES: Readonly<Record<PersonaDifficulty, string>> = {
  EASY: "bg-brand-success/10 text-brand-success",
  MEDIUM: "bg-brand-warning/10 text-brand-warning",
  HARD: "bg-brand-danger/10 text-brand-danger",
};

/** 10 persona cards to choose from (spec "components/simulator/PersonaSelector.tsx"). */
export function PersonaSelector({
  personas,
  selectedPersonaId,
  onSelect,
}: PersonaSelectorProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-2" role="listbox" aria-label="Pilih skenario">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Pilih Skenario
      </h2>
      <ul className="flex flex-col gap-2">
        {personas.map((persona) => {
          const isSelected = persona.id === selectedPersonaId;
          return (
            <li key={persona.id}>
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                data-testid="persona-card"
                data-persona-id={persona.id}
                onClick={() => onSelect(persona.id)}
                className={`flex w-full flex-col gap-1 rounded-card border p-3 text-left shadow-card transition-colors ${
                  isSelected
                    ? "border-brand-primary bg-brand-primary/5"
                    : "border-hairline bg-surface-card hover:border-brand-primary/40"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{persona.name}</span>
                  <span
                    data-testid="difficulty-badge"
                    className={`rounded-button px-2 py-0.5 text-xs font-semibold ${DIFFICULTY_CLASSES[persona.difficulty]}`}
                  >
                    {persona.difficulty}
                  </span>
                </span>
                <span className="text-xs text-ink-muted">{persona.description}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
