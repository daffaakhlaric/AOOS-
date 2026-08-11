import type { Result } from "@aos/common";

import type { SyncSession } from "../../domain/entities/SyncSession.js";
import type { SyncError } from "../../domain/errors/index.js";
import type { InventorySyncService } from "../services/InventorySyncService.js";
import type { Tracer } from "../tracer.js";

export interface SyncInventoryInput {
  readonly correlationId: string;
}

/** Triggers a full sync from every source attempted under the configured `SyncMode`. */
export class SyncInventory {
  constructor(
    private readonly syncService: InventorySyncService,
    private readonly tracer: Tracer,
  ) {}

  async execute(input: SyncInventoryInput): Promise<Result<SyncSession, SyncError>> {
    return this.tracer.startActiveSpan(
      "dss-inventory-connector.sync-inventory",
      async (span: { end: () => void }) => {
        try {
          return await this.syncService.syncAll(input.correlationId);
        } finally {
          span.end();
        }
      },
    );
  }
}
