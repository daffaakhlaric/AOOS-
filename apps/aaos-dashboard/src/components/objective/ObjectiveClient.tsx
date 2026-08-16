"use client";

import { useEffect, useState } from "react";

import { ObjectiveCard } from "@/components/objective/ObjectiveCard";
import { ObjectiveForm, type ObjectiveFormValues } from "@/components/objective/ObjectiveForm";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { ObjectiveDto } from "@/types/dashboard.types";

import styles from "./ObjectiveClient.module.css";

/** Fetches/creates the current objective via `/api/objective` (spec "objective/page.tsx"). */
export function ObjectiveClient(): React.ReactElement {
  const [objective, setObjective] = useState<ObjectiveDto | null | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

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
      .then((body) => setObjective(body.objective))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal menyimpan objective.");
      })
      .finally(() => setSubmitting(false));
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
    </div>
  );
}
