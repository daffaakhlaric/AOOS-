import type { Result } from "@aos/common";

import type { SyncSession } from "../../domain/entities/SyncSession.js";
import type { SyncError } from "../../domain/errors/index.js";
import type { SourceSystem } from "../../domain/value-objects/SourceSystem.js";
import type { InventorySyncService } from "../services/InventorySyncService.js";
import type { Tracer } from "../tracer.js";

export interface SyncFromSourceInput {
  readonly source: SourceSystem;
  readonly correlationId: string;
}

/** Triggers a sync from exactly one source adapter, bypassing `SyncMode`. */
export class SyncFromSource {
  constructor(
    private readonly syncService: InventorySyncService,
    private readonly tracer: Tracer,
  ) {}

  async execute(input: SyncFromSourceInput): Promise<Result<SyncSession, SyncError>> {
    return this.tracer.startActiveSpan(
      "dss-inventory-connector.sync-from-source",
      async (span: { end: () => void }) => {
        try {
          return await this.syncService.syncFromSource(input.source, input.correlationId);
        } finally {
          span.end();
        }
      },
    );
  }
}
