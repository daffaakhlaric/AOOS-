"use client";

import { useEffect, useState } from "react";

import type { BudgetSuggestionDto, PropertyObjectiveDto } from "@/types/property-objective.types";
import type { ListingDto, ListingListDto } from "@/types/listing.types";

import { MarketSignalsCard } from "./MarketSignalsCard";
import styles from "./PropertyObjectiveForm.module.css";
import { RecommendationChecklist } from "./RecommendationChecklist";

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
  /** AAOS LOOP UPGRADE, Sprint 6 Prompt 15 — the tenant's real, already-persisted current objective (if any), so the "Konteks Bisnis" card can prefill its 3 inputs and PATCH the real, existing row instead of guessing at one. `undefined` when no objective has been set yet this period — the card still renders (per the spec's own UI placement, above the stepper) but its inputs are disabled with an honest explanation until an objective exists to attach business context to. */
  readonly existingObjective?: PropertyObjectiveDto;
  /** Called after a real, successful `PATCH /api/property-objective/business-context` — lets the parent refresh its own copy of the objective (same "parent owns the fetched data, child reports success" convention `onSubmit` already establishes). */
  readonly onBusinessContextSaved?: (updated: PropertyObjectiveDto) => void;
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
 *
 * USER FEEDBACK FIX (post-ship): "Fokus Listing" was originally a free-text comma-separated input
 * — real user testing found this confusing ("ambil list dari listing manager"). Reuses the SAME
 * real `GET /api/listings?status=AKTIF` route `PropertyManualBriefForm.tsx` already calls (no new
 * listings-fetching mechanism) as a checkbox picker over real `ListingDto.title` values — the
 * checked titles ARE `focusListings` directly (still free `string[]` server-side, per O1's own real
 * DTO — no listing-id coupling invented). Also fixed: a failed/non-2xx budget-suggestion fetch
 * previously failed completely silently (the button just returned to its idle label with nothing
 * shown) — now surfaces a real, honest error message instead of leaving the user guessing.
 */
export function PropertyObjectiveForm({
  onSubmit,
  submitting = false,
  existingObjective,
  onBusinessContextSaved,
}: PropertyObjectiveFormProps): React.ReactElement {
  // AAOS LOOP UPGRADE, Sprint 6 Prompt 15 — "Konteks Bisnis" card state, prefilled from the real,
  // already-persisted objective (if any). Kept as raw string inputs (same convention every other
  // numeric field in this form already uses) so an empty field is honestly distinguishable from a
  // real `0`.
  const [avgDealValue, setAvgDealValue] = useState(
    existingObjective?.avgDealValue !== undefined ? String(existingObjective.avgDealValue) : "",
  );
  const [targetCpl, setTargetCpl] = useState(
    existingObjective?.targetCpl !== undefined ? String(existingObjective.targetCpl) : "",
  );
  const [breakevenCpl, setBreakevenCpl] = useState(
    existingObjective?.breakevenCpl !== undefined ? String(existingObjective.breakevenCpl) : "",
  );
  const [businessContextError, setBusinessContextError] = useState<string | undefined>(undefined);
  const [businessContextSaving, setBusinessContextSaving] = useState(false);
  const [businessContextSaved, setBusinessContextSaved] = useState(false);

  // AAOS LOOP UPGRADE, Sprint 8c — "Automasi Campaign" card state. `autoPublishCampaign` defaults
  // to the real, user-confirmed safety default (`false`) whenever `existingObjective` is
  // `undefined` OR the field itself is somehow missing — never defaults to `true` client-side, same
  // "never silently default to the unsafe value" discipline `PropertyObjectiveService
  // .getAutoPublishSettingsSafe`'s own `?? false` fallback establishes server-side.
  const [autoPublishCampaign, setAutoPublishCampaign] = useState(
    existingObjective?.autoPublishCampaign ?? false,
  );
  const [maxBudgetIncreasePct, setMaxBudgetIncreasePct] = useState(
    String(existingObjective?.maxBudgetIncreasePct ?? 20),
  );
  const [autoPublishError, setAutoPublishError] = useState<string | undefined>(undefined);
  const [autoPublishSaving, setAutoPublishSaving] = useState(false);
  const [autoPublishSaved, setAutoPublishSaved] = useState(false);

  async function saveAutoPublishSettings(nextAutoPublishCampaign: boolean): Promise<void> {
    setAutoPublishError(undefined);
    setAutoPublishSaved(false);
    const pct = maxBudgetIncreasePct.trim() === "" ? undefined : Number(maxBudgetIncreasePct);
    if (pct !== undefined && (!Number.isFinite(pct) || pct <= 0)) {
      setAutoPublishError("Batas kenaikan budget harus angka lebih dari 0.");
      return;
    }
    setAutoPublishSaving(true);
    try {
      const res = await fetch("/api/property-objective/auto-publish-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          autoPublishCampaign: nextAutoPublishCampaign,
          ...(pct !== undefined ? { maxBudgetIncreasePct: pct } : {}),
        }),
      });
      if (!res.ok) {
        const responseBody = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(responseBody.error?.message ?? "Gagal menyimpan pengaturan automasi.");
      }
      const responseBody = (await res.json()) as { objective: PropertyObjectiveDto };
      setAutoPublishCampaign(responseBody.objective.autoPublishCampaign);
      setMaxBudgetIncreasePct(String(responseBody.objective.maxBudgetIncreasePct));
      setAutoPublishSaved(true);
      onBusinessContextSaved?.(responseBody.objective);
    } catch (caught) {
      // Real, honest rollback: a failed save must never leave the toggle showing a state that was
      // not actually persisted (the exact class of bug this whole safety-critical dispatch exists
      // to prevent — a UI silently implying auto-publish is on/off when the real DB row disagrees).
      setAutoPublishCampaign(existingObjective?.autoPublishCampaign ?? false);
      setAutoPublishError(
        caught instanceof Error ? caught.message : "Gagal menyimpan pengaturan automasi.",
      );
    } finally {
      setAutoPublishSaving(false);
    }
  }

  async function saveBusinessContext(): Promise<void> {
    setBusinessContextError(undefined);
    setBusinessContextSaved(false);
    const avg = avgDealValue.trim() === "" ? undefined : Number(avgDealValue);
    const target = targetCpl.trim() === "" ? undefined : Number(targetCpl);
    const breakeven = breakevenCpl.trim() === "" ? undefined : Number(breakevenCpl);
    if (avg !== undefined && (!Number.isFinite(avg) || avg < 0)) {
      setBusinessContextError("Rata-rata nilai closing harus angka >= 0.");
      return;
    }
    if (target !== undefined && (!Number.isFinite(target) || target < 0)) {
      setBusinessContextError("Target CPL harus angka >= 0.");
      return;
    }
    if (breakeven !== undefined && (!Number.isFinite(breakeven) || breakeven < 0)) {
      setBusinessContextError("Batas maksimal CPL harus angka >= 0.");
      return;
    }
    if (target !== undefined && breakeven !== undefined && breakeven <= target) {
      setBusinessContextError(
        "Batas maksimal biaya per HOT lead harus lebih besar dari target biaya per HOT lead.",
      );
      return;
    }
    setBusinessContextSaving(true);
    try {
      const res = await fetch("/api/property-objective/business-context", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(avg !== undefined ? { avgDealValue: avg } : {}),
          ...(target !== undefined ? { targetCpl: target } : {}),
          ...(breakeven !== undefined ? { breakevenCpl: breakeven } : {}),
        }),
      });
      if (!res.ok) {
        const responseBody = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(responseBody.error?.message ?? "Gagal menyimpan konteks bisnis.");
      }
      const responseBody = (await res.json()) as { objective: PropertyObjectiveDto };
      setBusinessContextSaved(true);
      onBusinessContextSaved?.(responseBody.objective);
    } catch (caught) {
      setBusinessContextError(
        caught instanceof Error ? caught.message : "Gagal menyimpan konteks bisnis.",
      );
    } finally {
      setBusinessContextSaving(false);
    }
  }

  const [targetHotLeads, setTargetHotLeads] = useState("50");
  const [budgetAllocation, setBudgetAllocation] = useState("");
  const [budgetSource, setBudgetSource] = useState<"MANUAL" | "SAMANTHA_SUGGESTED">("MANUAL");
  const [budgetTouched, setBudgetTouched] = useState(false);
  const [suggestion, setSuggestion] = useState<BudgetSuggestionDto | undefined>(undefined);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | undefined>(undefined);
  const [listings, setListings] = useState<readonly ListingDto[] | undefined>(undefined);
  const [listingsError, setListingsError] = useState<string | undefined>(undefined);
  const [focusListings, setFocusListings] = useState<readonly string[]>([]);
  const [areaPrioritiesRaw, setAreaPrioritiesRaw] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  // Real listing picker — SAME `GET /api/listings?status=AKTIF` route `PropertyManualBriefForm.tsx`
  // already calls, no new listings-fetching mechanism (see this component's header doc).
  useEffect(() => {
    let active = true;
    fetch("/api/listings?status=AKTIF")
      .then(async (res) => {
        if (!res.ok) throw new Error("Gagal memuat daftar listing.");
        return (await res.json()) as ListingListDto;
      })
      .then((body) => {
        if (active) {
          setListings(body.listings);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setListingsError(caught instanceof Error ? caught.message : "Gagal memuat listing.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function toggleListing(title: string): void {
    setFocusListings((current) =>
      current.includes(title) ? current.filter((entry) => entry !== title) : [...current, title],
    );
  }

  async function fetchSuggestion(rawTarget: string): Promise<void> {
    const target = Number(rawTarget);
    if (!Number.isFinite(target) || target <= 0) {
      return;
    }
    setSuggestionLoading(true);
    setSuggestionError(undefined);
    try {
      const res = await fetch(
        `/api/property-objective/budget-suggestion?targetHotLeads=${encodeURIComponent(String(target))}`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        setSuggestionError(body.error?.message ?? "Gagal menghitung saran budget.");
        return;
      }
      const data = (await res.json()) as BudgetSuggestionDto;
      setSuggestion(data);
      if (data.available && !budgetTouched) {
        setBudgetAllocation(String(data.suggestedBudget));
        setBudgetSource("SAMANTHA_SUGGESTED");
      }
    } catch {
      setSuggestionError("Gagal menghitung saran budget — cek koneksi lalu coba lagi.");
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
      setError("Pilih minimal 1 fokus listing.");
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
      {/* SAMANTHA ADVANCED SPRINT 3 — "Rekomendasi Perbaikan" checklist, rendered at the very top
          of this form so it is the first thing a manager sees (real user feedback this dispatch
          addresses: "objective settingannya juga keliatan apa yang harus di perbaiki"). Reuses the
          SAME real `listings` state this component already loads for its own checkbox picker below
          — no second listings fetch. See `RecommendationChecklist.tsx`/`recommendationChecks.ts`
          for the real, deterministic (non-LLM) logic behind every item it can show. */}
      <RecommendationChecklist
        existingObjective={existingObjective}
        activeListingsCount={listings?.length}
      />

      {/* AAOS LOOP UPGRADE, Sprint 6 Prompt 15 — "Konteks Bisnis" card, rendered ABOVE the target
          HOT-leads stepper per the spec's own explicit UI placement. A genuinely separate save
          action from the objective form below it (own PATCH endpoint, own error/saved state) —
          the two forms edit different real resources (`property_objectives`'s business-context
          columns vs. its target/budget/focus columns) and a manager may want to update one without
          touching the other. */}
      <section
        className={styles.businessContextCard}
        data-testid="business-context-card"
        aria-label="Konteks Bisnis"
      >
        <h3 className={styles.businessContextTitle}>💰 Konteks Bisnis</h3>
        <p className={styles.hint}>
          Angka-angka ini dipakai Samantha untuk reasoning Verdict (PAUSE/lanjutkan campaign) supaya
          merujuk kondisi bisnis nyatamu, bukan threshold generik.
        </p>
        {existingObjective === undefined ? (
          <p className={styles.hint} data-testid="business-context-no-objective">
            Set Objective bulan ini dulu di bawah sebelum mengisi konteks bisnis.
          </p>
        ) : (
          <>
            <div className={styles.row}>
              <label className={styles.field}>
                Rata-rata nilai closing per transaksi (Rp)
                <input
                  type="number"
                  min={0}
                  placeholder="cth. 50000000"
                  value={avgDealValue}
                  onChange={(event) => setAvgDealValue(event.target.value)}
                  className={styles.input}
                />
                <span className={styles.hint}>
                  Dipakai untuk konteks ROI — belum langsung memengaruhi Verdict hari ini.
                </span>
              </label>
              <label className={styles.field}>
                Target biaya per HOT lead (Rp)
                <input
                  type="number"
                  min={0}
                  placeholder="cth. 25000"
                  value={targetCpl}
                  onChange={(event) => setTargetCpl(event.target.value)}
                  className={styles.input}
                />
                <span className={styles.hint}>
                  Campaign dengan CPL di bawah angka ini dianggap sehat oleh Samantha.
                </span>
              </label>
              <label className={styles.field}>
                Batas maksimal biaya per HOT lead (Rp)
                <input
                  type="number"
                  min={0}
                  placeholder="cth. 30000"
                  value={breakevenCpl}
                  onChange={(event) => setBreakevenCpl(event.target.value)}
                  className={styles.input}
                />
                <span className={styles.hint}>
                  CPL di atas angka ini → Samantha merekomendasikan PAUSE. Harus lebih besar dari
                  target biaya per HOT lead.
                </span>
              </label>
            </div>
            {businessContextError !== undefined ? (
              <p className={styles.error} data-testid="business-context-error">
                {businessContextError}
              </p>
            ) : null}
            <div className={styles.footer}>
              <button
                type="button"
                className={styles.submitButton}
                disabled={businessContextSaving}
                onClick={() => void saveBusinessContext()}
              >
                {businessContextSaving ? "Menyimpan..." : "💾 Simpan Konteks Bisnis"}
              </button>
              {businessContextSaved ? (
                <span data-testid="business-context-saved" className={styles.hint}>
                  Tersimpan.
                </span>
              ) : null}
            </div>
          </>
        )}
      </section>

      {/* AAOS LOOP UPGRADE, Sprint 8c (Prompt 19 Steps 5-6) — "Automasi Campaign" card: the real
          Settings UI this dispatch's own coordinator note requires for `auto_publish_campaign`
          (real DB default OFF) / `max_budget_increase_pct` (real DB default 20%). Rendered right
          after Konteks Bisnis, same "own PATCH endpoint, own error/saved state, gated on an
          existing objective" shape that card already establishes — these settings likewise attach
          to the tenant's real current-period `property_objectives` row. */}
      <section
        className={styles.businessContextCard}
        data-testid="auto-publish-settings-card"
        aria-label="Automasi Campaign"
      >
        <h3 className={styles.businessContextTitle}>🚀 Automasi Campaign</h3>
        <p className={styles.hint}>
          Kalau ada asset kreatif baru dari Kai untuk listing yang belum punya campaign aktif,
          Samantha bisa langsung publish campaign-nya di mode LIVE — TANPA toggle ini aktif, publish
          tetap butuh approve manual kamu dulu.
        </p>
        {existingObjective === undefined ? (
          <p className={styles.hint} data-testid="auto-publish-settings-no-objective">
            Set Objective bulan ini dulu di bawah sebelum mengatur automasi campaign.
          </p>
        ) : (
          <>
            <div className={styles.row}>
              <label className={styles.field}>
                <input
                  type="checkbox"
                  checked={autoPublishCampaign}
                  disabled={autoPublishSaving}
                  data-testid="auto-publish-campaign-toggle"
                  onChange={(event) => {
                    const next = event.target.checked;
                    setAutoPublishCampaign(next);
                    void saveAutoPublishSettings(next);
                  }}
                />{" "}
                Izinkan Samantha publish campaign otomatis di mode LIVE (default: nonaktif)
              </label>
              <label className={styles.field}>
                Batas maksimal kenaikan budget harian (%)
                <input
                  type="number"
                  min={1}
                  placeholder="cth. 20"
                  value={maxBudgetIncreasePct}
                  disabled={autoPublishSaving}
                  data-testid="max-budget-increase-pct-input"
                  onChange={(event) => setMaxBudgetIncreasePct(event.target.value)}
                  onBlur={() => void saveAutoPublishSettings(autoPublishCampaign)}
                  className={styles.input}
                />
                <span className={styles.hint}>
                  Kenaikan budget di atas batas ini SELALU butuh approve manual, walau toggle di
                  atas aktif.
                </span>
              </label>
            </div>
            {autoPublishError !== undefined ? (
              <p className={styles.error} data-testid="auto-publish-settings-error">
                {autoPublishError}
              </p>
            ) : null}
            {autoPublishSaved ? (
              <span data-testid="auto-publish-settings-saved" className={styles.hint}>
                Tersimpan.
              </span>
            ) : null}
          </>
        )}
      </section>

      {/* AAOS LOOP UPGRADE, Sprint 7 Prompt 18 — "Sinyal Pasar" card, rendered directly below
          Konteks Bisnis per the spec's own "di bawah Card Konteks Bisnis" placement instruction —
          see `MarketSignalsCard`'s own doc for why THIS is the real, current analog of that
          placement after the `/campaigns` unified-page rebuild. */}
      <MarketSignalsCard />

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
            {suggestionError !== undefined ? (
              <span data-testid="budget-suggestion-error" className={styles.error}>
                {suggestionError}
              </span>
            ) : null}
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
        <fieldset className={styles.fieldset}>
          <legend>Fokus Listing</legend>
          {listingsError !== undefined ? <p className={styles.error}>{listingsError}</p> : null}
          {listings === undefined && listingsError === undefined ? (
            <p className={styles.hint}>Memuat listing…</p>
          ) : null}
          {listings !== undefined && listings.length === 0 ? (
            <p className={styles.hint}>
              Belum ada listing aktif — tambahkan dulu di Listing Manager.
            </p>
          ) : null}
          {listings !== undefined && listings.length > 0 ? (
            <div className={styles.checkboxRow}>
              {listings.map((listing) => {
                const checked = focusListings.includes(listing.title);
                return (
                  <label
                    key={listing.id}
                    className={`${styles.checkboxLabel} ${checked ? styles.checkboxLabelChecked : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleListing(listing.title)}
                      className={styles.checkboxInput}
                    />
                    {listing.title}
                  </label>
                );
              })}
            </div>
          ) : null}
        </fieldset>
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
