"use client";

import { useEffect, useState } from "react";

import { CreativePackageCard } from "@/components/creative/CreativePackageCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { CreativePackageDto } from "@/types/dashboard.types";

/** Lists pending creative packages via `/api/creative` and wires approve/reject (spec "creative/page.tsx"). */
export function CreativeClient(): React.ReactElement {
  const [packages, setPackages] = useState<readonly CreativePackageDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | undefined>(undefined);

  function load(): void {
    fetch("/api/creative")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat creative packages.");
        }
        return (await res.json()) as { packages: readonly CreativePackageDto[] };
      })
      .then((body) => setPackages(body.packages))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat creative packages.");
      });
  }

  useEffect(load, []);

  function review(
    pkg: CreativePackageDto,
    action: "approve" | "reject",
    selectedCopyVariantId?: string,
  ): void {
    setBusyId(pkg.id);
    fetch(`/api/creative/${encodeURIComponent(pkg.id)}/${action}`, {
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
      .then((body) => {
        setPackages((current) =>
          current?.map((candidate) =>
            candidate.id === body.package.id ? body.package : candidate,
          ),
        );
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memproses package.");
      })
      .finally(() => setBusyId(undefined));
  }

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (packages === undefined) {
    return <LoadingSpinner />;
  }
  const pending = packages.filter((pkg) => pkg.status === "PENDING");
  if (pending.length === 0) {
    return (
      <EmptyState
        title="Tidak ada package menunggu review"
        description="Semua package sudah direview."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h2 className="text-base font-semibold text-ink">🎨 Creative Review</h2>
        <p className="text-sm text-ink-muted">Package dari Kai siap untuk di-review</p>
      </div>
      {pending.map((pkg) => (
        <CreativePackageCard
          key={pkg.id}
          pkg={pkg}
          busy={busyId === pkg.id}
          onApprove={(selectedCopyVariantId) => review(pkg, "approve", selectedCopyVariantId)}
          onReject={() => review(pkg, "reject")}
        />
      ))}
    </div>
  );
}
