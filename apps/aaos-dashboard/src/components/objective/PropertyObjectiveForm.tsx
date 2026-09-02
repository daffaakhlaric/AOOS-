"use client";

import { useState } from "react";

import type { BudgetSuggestionDto } from "@/types/property-objective.types";

import styles from "./PropertyObjectiveForm.module.css";

export interface PropertyObjectiveFormValues {
  readonly targetHotLeads: number;
  readonly budgetAllocation: number;
  readonly budgetSource: "MANUAL" | "SAMANTHA_SUGGESTED";
  readonly focusListings: readonly string[];
  readonly areaPriorities: readonly string[];
}

export interface PropertyObjectiveFormProps {
  readonly onSubmit: (values: PropertyObjectiveFormValues) => void;
  readonly submitting?: boolean;
}

/**
 * PROPERTY tenants' Objective form (Phase O2,
 * `docs/PROMPT-AAOS-TENANT-SCOPING-AND-PROPERTY-OBJECTIVE.md`) — a GENUINELY SEPARATE component
 * from `ObjectiveForm.tsx`, not an `isProperty` branch inside it, mirroring
 * `PropertyManualBriefForm.tsx`'s own real precedent for the same reason: the two verticals' real
 * fields diverge (no `Branch`/car-model catalog on this side; a real Samantha-computed budget
 * suggestion with no AUTOMOTIVE equivalent) enough that threading both through one component's
 * state would be strictly harder to read than two small, honest components — matching the same
 * separate-DTO/separate-endpoint decision O1 already made server-side.
 *
 * REAL UX DECISION on when the budget-suggestion re-fetch fires: on **blur** of the "Target Hot
 * Leads" field (not on every keystroke — no debounce timer needed, and it avoids spamming
 * `GET /api/property-objective/budget-suggestion` while the user is still typing), plus an
 * explicit "🔄 Hitung Saran Budget" button next to the field so the user can re-trigger the
 * calculation on demand (e.g. after fixing a typo without blurring, or re-checking the suggestion
 * after having manually overridden the budget). CORRECTION (independent review): this component
 * does NOT fetch a suggestion on mount — the budget field genuinely starts blank until the user
 * blurs the target field or presses the button, real behavior that an earlier draft of this
 * comment inaccurately described as "pre-filled from the very first render".
 *
 * The budget field itself is ALWAYS a normal, editable `<input type="number">` — never hidden or
 * forced — per the user's own confirmed requirement. The moment the user types into it directly,
 * `budgetSource` flips from `"SAMANTHA_SUGGESTED"` to `"MANUAL"` for real, honest provenance
 * (mirrors O1's own `budget_source` column's purpose) and the field is never silently
 * auto-overwritten by a later suggestion again.
 */
export function PropertyObjectiveForm({
  onSubmit,
  submitting = false,
}: PropertyObjectiveFormProps): React.ReactElement {
  const [targetHotLeads, setTargetHotLeads] = useState("50");
  const [budgetAllocation, setBudgetAllocation] = useState("");
  const [budgetSource, setBudgetSource] = useState<"MANUAL" | "SAMANTHA_SUGGESTED">("MANUAL");
  const [budgetTouched, setBudgetTouched] = useState(false);
  const [suggestion, setSuggestion] = useState<BudgetSuggestionDto | undefined>(undefined);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [focusListingsRaw, setFocusListingsRaw] = useState("");
  const [areaPrioritiesRaw, setAreaPrioritiesRaw] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  async function fetchSuggestion(rawTarget: string): Promise<void> {
    const target = Number(rawTarget);
    if (!Number.isFinite(target) || target <= 0) {
      return;
    }
    setSuggestionLoading(true);
    try {
      const res = await fetch(
        `/api/property-objective/budget-suggestion?targetHotLeads=${encodeURIComponent(String(target))}`,
      );
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as BudgetSuggestionDto;
      setSuggestion(data);
      if (data.available && !budgetTouched) {
        setBudgetAllocation(String(data.suggestedBudget));
        setBudgetSource("SAMANTHA_SUGGESTED");
      }
    } catch {
      // Best-effort only — a failed suggestion lookup just leaves the field for real manual entry.
    } finally {
      setSuggestionLoading(false);
    }
  }

  function handleBudgetChange(value: string): void {
    setBudgetAllocation(value);
    setBudgetTouched(true);
    setBudgetSource("MANUAL");
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    const target = Number(targetHotLeads);
    const budget = Number(budgetAllocation);
    const focusListings = focusListingsRaw
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    const areaPriorities = areaPrioritiesRaw
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    if (!Number.isFinite(target) || target <= 0) {
      setError("Target hot leads harus lebih dari 0.");
      return;
    }
    if (!Number.isFinite(budget) || budget <= 0) {
      setError("Budget iklan harus lebih dari 0.");
      return;
    }
    if (focusListings.length === 0) {
      setError("Isi minimal 1 fokus listing.");
      return;
    }
    if (areaPriorities.length === 0) {
      setError("Isi minimal 1 area prioritas.");
      return;
    }
    setError(undefined);
    onSubmit({
      targetHotLeads: target,
      budgetAllocation: budget,
      budgetSource,
      focusListings,
      areaPriorities,
    });
  }

  return (
    <div className={styles.card}>
      <form
        onSubmit={handleSubmit}
        noValidate
        className={styles.form}
        aria-label="Set objective properti"
      >
        <div className={styles.row}>
          <label className={styles.field}>
            Target Hot Leads
            <input
              type="number"
              min={1}
              placeholder="cth. 50"
              value={targetHotLeads}
              onChange={(event) => setTargetHotLeads(event.target.value)}
              onBlur={(event) => void fetchSuggestion(event.target.value)}
              className={styles.input}
            />
          </label>
          <label className={styles.field}>
            Budget Iklan (IDR)
            <div className={styles.inputWrap}>
              <input
                type="number"
                min={1}
                placeholder="cth. 30000000"
                value={budgetAllocation}
                onChange={(event) => handleBudgetChange(event.target.value)}
                className={`${styles.input} ${styles.inputWithPrefix}`}
              />
            </div>
            <button
              type="button"
              className={styles.suggestButton}
              disabled={suggestionLoading}
              onClick={() => void fetchSuggestion(targetHotLeads)}
            >
              {suggestionLoading ? "Menghitung..." : "🔄 Hitung Saran Budget"}
            </button>
            {suggestion !== undefined ? (
              suggestion.available ? (
                <span data-testid="budget-suggestion-hint" className={styles.hint}>
                  Saran Samantha: {suggestion.suggestedBudget.toLocaleString("id-ID")} (dari
                  rata-rata CPL portfolio {suggestion.portfolioAvgCplIDR.toLocaleString("id-ID")}
                  ). Angka ini tetap bisa kamu ubah.
                </span>
              ) : (
                <span data-testid="budget-suggestion-unavailable" className={styles.hint}>
                  Saran budget belum tersedia: {suggestion.reason} Isi budget secara manual.
                </span>
              )
            ) : null}
          </label>
        </div>
        <label className={styles.field}>
          Fokus Listing <span className={styles.hint}>(pisahkan dengan koma)</span>
          <input
            type="text"
            placeholder="cth. Cluster Anggrek, Rumah Blok C5"
            value={focusListingsRaw}
            onChange={(event) => setFocusListingsRaw(event.target.value)}
            className={styles.input}
          />
        </label>
        <label className={styles.field}>
          Area Prioritas <span className={styles.hint}>(pisahkan dengan koma)</span>
          <input
            type="text"
            placeholder="cth. Bintaro, Serpong, BSD"
            value={areaPrioritiesRaw}
            onChange={(event) => setAreaPrioritiesRaw(event.target.value)}
            className={styles.input}
          />
        </label>
        {error !== undefined ? <p className={styles.error}>{error}</p> : null}
        <div className={styles.footer}>
          <button type="submit" disabled={submitting} className={styles.submitButton}>
            ✅ Set Objective
          </button>
        </div>
      </form>
    </div>
  );
}
