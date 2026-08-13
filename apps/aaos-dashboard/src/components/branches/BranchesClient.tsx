"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { BranchCard } from "@/components/branches/BranchCard";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { BranchDto } from "@/types/dashboard.types";

/** Branch settings overview — lists every branch (spec "branches/page.tsx"). */
export function BranchesClient(): React.ReactElement {
  const [branches, setBranches] = useState<readonly BranchDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch("/api/branches")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat branch.");
        }
        return (await res.json()) as { branches: readonly BranchDto[] };
      })
      .then((body) => setBranches(body.branches))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat branch.");
      });
  }, []);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (branches === undefined) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex flex-col gap-3 p-6">
      <h2 className="text-base font-semibold text-ink">⚙️ Branch Settings</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {branches.map((branch) => (
          <Link key={branch.id} href={`/branches/${branch.id}`}>
            <BranchCard branch={branch} />
          </Link>
        ))}
      </div>
    </div>
  );
}
