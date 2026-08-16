"use client";

import { useState } from "react";

import styles from "./ObjectiveForm.module.css";

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
    <form onSubmit={handleSubmit} className={styles.form} aria-label="Set objective">
      <label className={styles.field}>
        Target Hot Leads
        <input
          type="number"
          value={targetHotLeads}
          onChange={(event) => setTargetHotLeads(event.target.value)}
          className={styles.input}
        />
      </label>
      <label className={styles.field}>
        Budget Iklan (IDR)
        <input
          type="number"
          value={budgetAllocation}
          onChange={(event) => setBudgetAllocation(event.target.value)}
          className={styles.input}
        />
      </label>
      <label className={styles.field}>
        Fokus Unit (pisahkan dengan koma)
        <input
          type="text"
          value={focusUnitsRaw}
          onChange={(event) => setFocusUnitsRaw(event.target.value)}
          className={styles.input}
        />
      </label>
      <fieldset className={styles.fieldset}>
        <legend>Area Prioritas</legend>
        <div className={styles.checkboxRow}>
          {AREA_OPTIONS.map((area) => (
            <label key={area} className={styles.checkboxLabel}>
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
      {error !== undefined ? <p className={styles.error}>{error}</p> : null}
      <button type="submit" disabled={submitting} className={styles.submitButton}>
        ✅ Set Objective
      </button>
    </form>
  );
}
