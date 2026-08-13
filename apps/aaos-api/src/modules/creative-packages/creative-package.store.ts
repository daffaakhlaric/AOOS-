import { Injectable } from "@nestjs/common";

/** `PENDING` → awaiting DSS Motor review · `APPROVED`/`REJECTED` → reviewed (terminal). */
export type CreativePackageReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface StoredCopyVariant {
  readonly id: string;
  readonly variantLabel: "A" | "B" | "C";
  readonly primaryText: string;
  readonly headline: string;
  readonly callToAction: string;
}

export interface StoredCreativePackage {
  readonly id: string;
  readonly briefId: string;
  readonly branch: string;
  readonly unit: string;
  readonly title: string;
  readonly videoUrl?: string;
  readonly imageUrls: readonly string[];
  readonly copyVariants: readonly StoredCopyVariant[];
  readonly status: CreativePackageReviewStatus;
  readonly selectedCopyVariantId?: string;
  readonly createdAt: string;
  readonly reviewedAt?: string;
}

export type CreateCreativePackageInput = Omit<
  StoredCreativePackage,
  "id" | "status" | "createdAt" | "reviewedAt" | "selectedCopyVariantId"
>;

/**
 * AAOS-W4A coordinator note #3: nothing in `@aos/creative-agent` (whose `GenerationJobRegistry`
 * is explicitly scoped to generation-job status only), `@aos/lead-store`, or `@aos/asset-library`
 * stores "pending creative packages awaiting DSS approval" — there is no `ListPending`/`Approve`/
 * `Reject` use case or persisted entity anywhere upstream. This class is a small,
 * clearly-documented, PROCESS-LOCAL IN-MEMORY store built inside `apps/aaos-api` itself to give
 * the new `creative-packages` endpoints something real to read from and write to.
 *
 * KNOWN MVP LIMITATION (do not mistake this for durable persistence): this store's contents are
 * lost on every process restart/redeploy, are not shared across multiple `aaos-api` instances,
 * and there is no reconciliation with `@aos/creative-agent`'s actual generation pipeline —
 * nothing currently calls `ProcessCreativeBrief` and lands its result here. Real durable
 * persistence (a new Supabase table, mirroring `@aos/lead-store`'s pattern) is explicitly
 * follow-up work outside AAOS-W4A's stated scope.
 *
 * `seed()` exists so the dashboard has real, non-empty data to display/test against out of the
 * box (judgment call, per the coordinator note's "consider whether the module also needs a way
 * to seed entries" guidance) — it is idempotent (only seeds an empty store) and is invoked once
 * from `CreativePackagesModule`'s provider factory, never on every request.
 */
@Injectable()
export class CreativePackageStore {
  private readonly packages = new Map<string, StoredCreativePackage>();

  create(input: CreateCreativePackageInput, id: string, createdAt: string): StoredCreativePackage {
    const record: StoredCreativePackage = {
      ...input,
      id,
      status: "PENDING",
      createdAt,
    };
    this.packages.set(id, record);
    return record;
  }

  list(): readonly StoredCreativePackage[] {
    return [...this.packages.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  findById(id: string): StoredCreativePackage | undefined {
    return this.packages.get(id);
  }

  /** Transitions a `PENDING` package to `APPROVED`/`REJECTED`. Returns `undefined` if `id` is unknown; throws nothing — callers translate `undefined` to a 404. Re-reviewing an already-terminal package is allowed (idempotent overwrite) since this is an MVP in-memory store, not a durable audit log. */
  review(
    id: string,
    status: "APPROVED" | "REJECTED",
    reviewedAt: string,
    selectedCopyVariantId?: string,
  ): StoredCreativePackage | undefined {
    const existing = this.packages.get(id);
    if (existing === undefined) {
      return undefined;
    }
    const updated: StoredCreativePackage = {
      ...existing,
      status,
      reviewedAt,
      selectedCopyVariantId: selectedCopyVariantId ?? existing.selectedCopyVariantId,
    };
    this.packages.set(id, updated);
    return updated;
  }

  /** Idempotent: only seeds when the store is empty (never overwrites real data with fixtures after the process has handled real traffic). */
  seed(entries: readonly StoredCreativePackage[]): void {
    if (this.packages.size > 0) {
      return;
    }
    for (const entry of entries) {
      this.packages.set(entry.id, entry);
    }
  }
}
