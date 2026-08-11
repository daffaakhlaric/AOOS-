import { err, ok, type Result } from "@aos/common";

import type { IBranchRegistry } from "../contracts/IBranchRegistry.js";
import type { BranchConfig } from "../domain/entities/BranchConfig.js";
import { BranchConfigError, BranchNotFoundError } from "../domain/errors/index.js";
import type { BranchId } from "../domain/value-objects/BranchId.js";

/**
 * Registry Pattern — id-keyed and phone-number-id-keyed lookup for the 4 DSS Motor branches, seeded
 * once at construction (by `BranchManagerFactory`, from `BranchManagerConfig` — never a hardcoded
 * `process.env` read inside this class).
 */
export class BranchRegistry implements IBranchRegistry {
  private readonly byId = new Map<BranchId, BranchConfig>();
  private readonly byPhoneNumberId = new Map<string, BranchConfig>();

  constructor(configs: readonly BranchConfig[]) {
    for (const config of configs) {
      this.byId.set(config.id, config);
      this.byPhoneNumberId.set(config.wabaPhoneNumberId.toString(), config);
    }
  }

  getByBranchId(id: BranchId): Result<BranchConfig, BranchNotFoundError> {
    const config = this.byId.get(id);
    if (config === undefined) {
      return err(new BranchNotFoundError(`No branch registered for BranchId "${id}"`));
    }
    return ok(config);
  }

  getByPhoneNumberId(phoneNumberId: string): Result<BranchConfig, BranchNotFoundError> {
    const config = this.byPhoneNumberId.get(phoneNumberId);
    if (config === undefined) {
      return err(
        new BranchNotFoundError(`No branch registered for phoneNumberId "${phoneNumberId}"`),
      );
    }
    return ok(config);
  }

  getAll(): readonly BranchConfig[] {
    return [...this.byId.values()];
  }

  /** Replaces an existing branch's configuration — fails with `BranchConfigError` if `config.id` isn't already registered (this is an update, not an insert). */
  update(config: BranchConfig): Result<BranchConfig, BranchConfigError> {
    const existing = this.byId.get(config.id);
    if (existing === undefined) {
      return err(new BranchConfigError(`Cannot update unregistered branch "${config.id}"`));
    }
    this.byId.set(config.id, config);
    this.byPhoneNumberId.delete(existing.wabaPhoneNumberId.toString());
    this.byPhoneNumberId.set(config.wabaPhoneNumberId.toString(), config);
    return ok(config);
  }
}
