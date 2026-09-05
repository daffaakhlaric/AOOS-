"use client";

import { useEffect, useState } from "react";

import { ObjectiveCard } from "@/components/objective/ObjectiveCard";
import { ObjectiveForm, type ObjectiveFormValues } from "@/components/objective/ObjectiveForm";
import { PropertyObjectiveCard } from "@/components/objective/PropertyObjectiveCard";
import {
  PropertyObjectiveForm,
  type PropertyObjectiveFormValues,
} from "@/components/objective/PropertyObjectiveForm";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Toast } from "@/components/ui/Toast";
import type { ObjectiveDto } from "@/types/dashboard.types";
import {
  isBusinessContextFilled,
  type PropertyObjectiveDto,
} from "@/types/property-objective.types";
import type { Vertical } from "@/types/tenant.types";

import styles from "./ObjectiveClient.module.css";

/**
 * Fetches/creates the current objective (spec "objective/page.tsx").
 *
 * Phase O2 (`docs/PROMPT-AAOS-TENANT-SCOPING-AND-PROPERTY-OBJECTIVE.md`) adds a real
 * PROPERTY-vertical branch here, resolved the SAME client-side `GET /api/settings` →
 * `tenant.vertical` way `Sidebar.tsx`/`CreativeClient.tsx`/`AssetLibraryClient.tsx` already do —
 * no second "who am I" mechanism invented. `vertical` defaults to `"AUTOMOTIVE"` (same default
 * `CreativeClient.tsx` uses), so this component's AUTOMOTIVE-tenant load call
 * (`GET /api/objective`) fires immediately on mount exactly as it always has — genuinely
 * unchanged network timing/behavior for the common AUTOMOTIVE case. A separate `settingsLoaded`
 * flag gates the loading→content transition so a PROPERTY tenant never sees a flash of the
 * AUTOMOTIVE `ObjectiveForm`/`ObjectiveCard` before the real vertical resolves (same "never a
 * flash of the wrong vertical's UI" discipline `AssetLibraryClient.tsx`'s Branch-filter fix
 * documents) — the extra `GET /api/objective` call this causes for a genuine PROPERTY tenant
 * during the brief unresolved window is a real, accepted, one-time cost, not a masked bug: it
 * lands on the tenant's own real (empty) automotive-objective row and is simply not rendered.
 *
 * `ObjectiveForm.tsx`/`ObjectiveCard.tsx` themselves are completely untouched — same props, same
 * submit/load functions, same rendered output for AUTOMOTIVE as before this phase.
 */
export function ObjectiveClient(): React.ReactElement {
  const [vertical, setVertical] = useState<Vertical>("AUTOMOTIVE");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const isProperty = vertical === "PROPERTY";

  const [objective, setObjective] = useState<ObjectiveDto | null | undefined>(undefined);
  const [propertyObjective, setPropertyObjective] = useState<
    PropertyObjectiveDto | null | undefined
  >(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) =>
        res.ok ? (res.json() as Promise<{ tenant?: { vertical?: Vertical } }>) : null,
      )
      .then((data) => {
        if (cancelled) return;
        if (data?.tenant?.vertical !== undefined) {
          setVertical(data.tenant.vertical);
        }
        setSettingsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setSettingsLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function load(): void {
    fetch("/api/objective")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat objective.");
        }
        return (await res.json()) as { objective: ObjectiveDto | null };
      })
      .then((body) => setObjective(body.objective))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat objective.");
      });
  }

  useEffect(load, []);

  function loadProperty(): void {
    fetch("/api/property-objective")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat objective.");
        }
        return (await res.json()) as { objective: PropertyObjectiveDto | null };
      })
      .then((body) => setPropertyObjective(body.objective))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat objective.");
      });
  }

  useEffect(() => {
    if (isProperty) {
      loadProperty();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per vertical resolution, mirrors `load()`'s own mount-only effect above.
  }, [isProperty]);

  function handleSubmit(values: ObjectiveFormValues): void {
    setSubmitting(true);
    setError(undefined);
    fetch("/api/objective", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json()) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Gagal menyimpan objective.");
        }
        return (await res.json()) as { objective: ObjectiveDto };
      })
      .then((body) => {
        setObjective(body.objective);
        setSavedToast(true);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal menyimpan objective.");
      })
      .finally(() => setSubmitting(false));
  }

  function handlePropertySubmit(values: PropertyObjectiveFormValues): void {
    setSubmitting(true);
    setError(undefined);
    fetch("/api/property-objective", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json()) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Gagal menyimpan objective.");
        }
        return (await res.json()) as { objective: PropertyObjectiveDto };
      })
      .then((body) => {
        setPropertyObjective(body.objective);
        setSavedToast(true);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal menyimpan objective.");
      })
      .finally(() => setSubmitting(false));
  }

  if (!settingsLoaded) {
    return <LoadingSpinner />;
  }

  if (isProperty) {
    if (propertyObjective === undefined && error === undefined) {
      return <LoadingSpinner />;
    }
    const existingObjective = propertyObjective ?? undefined;
    return (
      <div className={styles.page}>
        <h2 className={styles.title}>🎯 Objective Bulan Ini</h2>
        {error !== undefined ? <ErrorCard message={error} /> : null}
        {/* AAOS LOOP UPGRADE, Sprint 6 Prompt 15 — the spec's own fallback banner. Placed here
            (not a "Tab Verdict" — no such PROPERTY tab exists anywhere in this app; the closest
            real, honest PROPERTY-facing "AI decided X, here is why" surface is the Activity
            detail drawer's Reasoning tab, which has no dedicated banner slot of its own) rather
            than fabricating a Verdict tab that doesn't exist. */}
        {existingObjective !== undefined && !isBusinessContextFilled(existingObjective) ? (
          <p className={styles.businessContextBanner} data-testid="business-context-banner">
            ⚠ Isi konteks bisnis di Settings &gt; Objective supaya rekomendasi lebih akurat.
          </p>
        ) : null}
        {propertyObjective !== null && propertyObjective !== undefined ? (
          <PropertyObjectiveCard objective={propertyObjective} />
        ) : null}
        <PropertyObjectiveForm
          onSubmit={handlePropertySubmit}
          submitting={submitting}
          existingObjective={existingObjective}
          onBusinessContextSaved={(updated) => setPropertyObjective(updated)}
        />
        {savedToast ? (
          <Toast
            message="Objective berhasil disimpan"
            variant="success"
            onDismiss={() => setSavedToast(false)}
          />
        ) : null}
      </div>
    );
  }

  if (objective === undefined && error === undefined) {
    return <LoadingSpinner />;
  }

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>🎯 Objective Bulan Ini</h2>
      {error !== undefined ? <ErrorCard message={error} /> : null}
      {objective !== null && objective !== undefined ? (
        <ObjectiveCard objective={objective} />
      ) : null}
      <ObjectiveForm onSubmit={handleSubmit} submitting={submitting} />
      {savedToast ? (
        <Toast
          message="Objective berhasil disimpan"
          variant="success"
          onDismiss={() => setSavedToast(false)}
        />
      ) : null}
    </div>
  );
}
