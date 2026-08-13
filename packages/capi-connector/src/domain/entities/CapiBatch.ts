import { err, ok, type Result } from "@aos/common";

import { BatchError } from "../errors/BatchError.js";

import type { CapiEvent } from "./CapiEvent.js";

/** Meta CAPI accepts at most 1000 events per `POST /{pixel-id}/events` request. */
export const MAX_BATCH_SIZE = 1000;

/** An immutable, non-empty batch of `CapiEvent`s (max `MAX_BATCH_SIZE`), ready for one `ICapiClient.sendEvents` call. */
export class CapiBatch {
  private constructor(private readonly batchEvents: readonly CapiEvent[]) {}

  static create(events: readonly CapiEvent[]): Result<CapiBatch, BatchError> {
    if (events.length === 0) {
      return err(new BatchError("CapiBatch must contain at least one event"));
    }
    if (events.length > MAX_BATCH_SIZE) {
      return err(
        new BatchError(
          `CapiBatch must not exceed ${MAX_BATCH_SIZE} events, received: ${events.length}`,
        ),
      );
    }
    return ok(new CapiBatch([...events]));
  }

  get events(): readonly CapiEvent[] {
    return this.batchEvents;
  }

  get size(): number {
    return this.batchEvents.length;
  }
}
