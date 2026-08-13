"use client";

import { useState } from "react";

export interface ObjectiveFormValues {
  readonly targetHotLeads: number;
  readonly budgetAllocation: number;
  readonly focusUnits: readonly string[];
  readonly areaPriorities: readonly string[];
}

export interface ObjectiveFormProps {
  readonly onSubmit: (values: ObjectiveFormValues) => void;
  readonly submitting?: boolean;
}

const AREA_OPTIONS = ["BINTARO", "CINERE", "UMUM", "BANDUNG"] as const;

/** Set target leads + budget + focus units (spec "objective/page.tsx" mockup). Validation: `targetHotLeads > 0`, `budgetAllocation` accepts a plain IDR integer (spec "input validation: target > 0" / "budget input accepts IDR format"). */
export function ObjectiveForm({
  onSubmit,
  submitting = false,
}: ObjectiveFormProps): React.ReactElement {
  const [targetHotLeads, setTargetHotLeads] = useState("50");
  const [budgetAllocation, setBudgetAllocation] = useState("30000000");
  const [focusUnitsRaw, setFocusUnitsRaw] = useState("Xpander, Brio");
  const [areaPriorities, setAreaPriorities] = useState<string[]>(["BINTARO"]);
  const [error, setError] = useState<string | undefined>(undefined);

  function toggleArea(area: string): void {
    setAreaPriorities((current) =>
      current.includes(area) ? current.filter((a) => a !== area) : [...current, area],
    );
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    const target = Number(targetHotLeads);
    const budget = Number(budgetAllocation);
    const focusUnits = focusUnitsRaw
      .split(",")
      .map((unit) => unit.trim())
      .filter((unit) => unit.length > 0);

    if (!Number.isFinite(target) || target <= 0) {
      setError("Target hot leads harus lebih dari 0.");
      return;
    }
    if (!Number.isFinite(budget) || budget <= 0) {
      setError("Budget iklan harus lebih dari 0.");
      return;
    }
    if (focusUnits.length === 0) {
      setError("Pilih minimal 1 fokus unit.");
      return;
    }
    if (areaPriorities.length === 0) {
      setError("Pilih minimal 1 area prioritas.");
      return;
    }
    setError(undefined);
    onSubmit({ targetHotLeads: target, budgetAllocation: budget, focusUnits, areaPriorities });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" aria-label="Set objective">
      <label className="flex flex-col gap-1 text-sm text-ink">
        Target Hot Leads
        <input
          type="number"
          value={targetHotLeads}
          onChange={(event) => setTargetHotLeads(event.target.value)}
          className="rounded-button border border-hairline px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink">
        Budget Iklan (IDR)
        <input
          type="number"
          value={budgetAllocation}
          onChange={(event) => setBudgetAllocation(event.target.value)}
          className="rounded-button border border-hairline px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink">
        Fokus Unit (pisahkan dengan koma)
        <input
          type="text"
          value={focusUnitsRaw}
          onChange={(event) => setFocusUnitsRaw(event.target.value)}
          className="rounded-button border border-hairline px-3 py-2"
        />
      </label>
      <fieldset className="flex flex-col gap-1 text-sm text-ink">
        <legend>Area Prioritas</legend>
        <div className="flex flex-wrap gap-2">
          {AREA_OPTIONS.map((area) => (
            <label key={area} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={areaPriorities.includes(area)}
                onChange={() => toggleArea(area)}
              />
              {area}
            </label>
          ))}
        </div>
      </fieldset>
      {error !== undefined ? <p className="text-sm text-brand-danger">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-button bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        ✅ Set Objective
      </button>
    </form>
  );
}
