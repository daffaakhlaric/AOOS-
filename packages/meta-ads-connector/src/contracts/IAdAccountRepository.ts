import type { Option } from "@aos/common";

import type { AdAccount } from "../domain/entities/AdAccount.js";
import type { AdAccountId } from "../domain/value-objects/AdAccountId.js";

/**
 * Repository Pattern port for looking up the most recent synced `AdAccount` snapshot by id.
 *
 * Interface-only, per the spec ("Repository Pattern (interface only — no DB)") — this package
 * ships zero implementations that persist to a database or filesystem. The one implementation
 * that DOES exist in this package, `registry/AdAccountRegistry.ts`, is an in-memory, per-process
 * cache (not persistence) that happens to satisfy this port; a real `@aos/*` or app-level
 * package is expected to provide a durable implementation later (e.g. backed by `apps/aaos-api`).
 */
export interface IAdAccountRepository {
  findById(id: AdAccountId): Option<AdAccount>;
  save(adAccount: AdAccount): void;
}
