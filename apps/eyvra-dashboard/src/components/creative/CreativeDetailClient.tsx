"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CreativePackageCard } from "@/components/creative/CreativePackageCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDateTimeIdWib } from "@/lib/formatters";
import type { CreativePackageDetailDto } from "@/types/dashboard.types";

import styles from "./CreativeDetailClient.module.css";

/**
 * Creative detail + approve/reject.
 *
 * Now reads the REAL single-item endpoint (`GET /api/creative/:id` → `aaos-api`'s
 * `GET /api/v1/creative-packages/:id`), which also returns the package's own real `creative_logs`
 * trail. It previously had to fetch the entire package list and `.find()` the id client-side,
 * purely because no single-item endpoint existed.
 */
export function CreativeDetailClient({
  packageId,
}: {
  readonly packageId: string;
}): React.ReactElement {
  const router = useRouter();
  const [detail, setDetail] = useState<CreativePackageDetailDto | null | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/creative/${encodeURIComponent(packageId)}`)
      .then(async (res) => {
        if (res.status === 404) {
          return null;
        }
        if (!res.ok) {
          throw new Error("Gagal memuat package.");
        }
        return (await res.json()) as CreativePackageDetailDto;
      })
      .then((body) => setDetail(body))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat package.");
      });
  }, [packageId]);

  function review(action: "approve" | "reject", selectedCopyVariantId?: string): void {
    setBusy(true);
    fetch(`/api/creative/${encodeURIComponent(packageId)}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(action === "approve" ? { selectedCopyVariantId } : {}),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Gagal ${action === "approve" ? "menyetujui" : "menolak"} package.`);
        }
        return res.json();
      })
      .then(() => router.push("/creative"))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memproses package.");
      })
      .finally(() => setBusy(false));
  }

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (detail === undefined) {
    return <LoadingSpinner />;
  }
  if (detail === null) {
    return (
      <EmptyState
        title="Package tidak ditemukan"
        description={`Tidak ada package "${packageId}".`}
      />
    );
  }

  return (
    <div className={styles.page}>
      <CreativePackageCard
        pkg={detail.package}
        busy={busy}
        onApprove={(selectedCopyVariantId) => review("approve", selectedCopyVariantId)}
        onReject={() => review("reject")}
      />
      {detail.logs.length > 0 ? (
        <section data-testid="creative-detail-logs" className={styles.logs}>
          <h3 className={styles.logsHeading}>Log koordinasi package ini</h3>
          {detail.logs.map((entry) => (
            <p key={entry.id} className={styles.logLine}>
              <span className={styles.logTime}>{formatDateTimeIdWib(entry.createdAt)}</span>{" "}
              {entry.fromAgent}
              {entry.toAgent !== undefined ? ` → ${entry.toAgent}` : ""} · {entry.message}
            </p>
          ))}
        </section>
      ) : null}
    </div>
  );
}
