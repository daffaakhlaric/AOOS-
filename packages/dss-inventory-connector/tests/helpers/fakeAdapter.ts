import { err, ok, type Result } from "@aos/common";
import type { Branch } from "@aos/meta-ads-connector";
import { vi } from "vitest";

import type {
  AdapterHealth,
  IInventorySourceAdapter,
  RawInventoryUnit,
} from "../../src/contracts/IInventorySourceAdapter.js";
import type { AdapterError } from "../../src/domain/errors/index.js";
import type { SourcePriority } from "../../src/domain/value-objects/SourcePriority.js";
import type { SourceSystem } from "../../src/domain/value-objects/SourceSystem.js";

export interface FakeAdapterOptions {
  readonly sourceSystem: SourceSystem;
  readonly priority: SourcePriority;
  readonly configured?: boolean;
  readonly units?: RawInventoryUnit[];
  readonly fetchError?: AdapterError;
  readonly rejectWith?: Error;
  readonly health?: AdapterHealth;
}

/** A fully-controllable `IInventorySourceAdapter` test double — lets tests simulate "configured but failing" and "rejects instead of resolving" scenarios the 3 real shell adapters can never produce on their own (they only ever fail via `isConfigured() === false`). */
export function createFakeAdapter(options: FakeAdapterOptions): IInventorySourceAdapter {
  return {
    sourceSystem: options.sourceSystem,
    priority: options.priority,
    isConfigured: vi.fn(() => options.configured ?? true),
    fetchUnits: vi.fn(async (): Promise<Result<RawInventoryUnit[], AdapterError>> => {
      if (options.rejectWith) {
        throw options.rejectWith;
      }
      if (options.fetchError) {
        return err(options.fetchError);
      }
      return ok(options.units ?? []);
    }),
    fetchUnitsByBranch: vi.fn(
      async (_branch: Branch): Promise<Result<RawInventoryUnit[], AdapterError>> => {
        if (options.rejectWith) {
          throw options.rejectWith;
        }
        if (options.fetchError) {
          return err(options.fetchError);
        }
        return ok(options.units ?? []);
      },
    ),
    healthCheck: vi.fn(async (): Promise<Result<AdapterHealth, AdapterError>> =>
      ok(options.health ?? { healthy: options.configured ?? true }),
    ),
  };
}
