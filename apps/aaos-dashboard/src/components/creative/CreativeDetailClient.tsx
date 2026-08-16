"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { CreativePackageCard } from "@/components/creative/CreativePackageCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { CreativePackageDto } from "@/types/dashboard.types";

import styles from "./CreativeDetailClient.module.css";

/** Creative detail + approve/reject (spec "creative/[packageId]/page.tsx"). `aaos-api` has no single-package lookup endpoint, so this finds `packageId` within the same `GET /api/v1/creative-packages` list `/creative` uses. */
export function CreativeDetailClient({
  packageId,
}: {
  readonly packageId: string;
}): React.ReactElement {
  const router = useRouter();
  const [pkg, setPkg] = useState<CreativePackageDto | null | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/creative")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat package.");
        }
        return (await res.json()) as { packages: readonly CreativePackageDto[] };
      })
      .then((body) => setPkg(body.packages.find((candidate) => candidate.id === packageId) ?? null))
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
        return (await res.json()) as { package: CreativePackageDto };
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
  if (pkg === undefined) {
    return <LoadingSpinner />;
  }
  if (pkg === null) {
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
        pkg={pkg}
        busy={busy}
        onApprove={(selectedCopyVariantId) => review("approve", selectedCopyVariantId)}
        onReject={() => review("reject")}
      />
    </div>
  );
}
