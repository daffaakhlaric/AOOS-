import type { Result } from "@aos/common";

import type { CapiEvent } from "../domain/entities/CapiEvent.js";
import type { EventResult } from "../domain/entities/EventResult.js";
import type { CapiError } from "../domain/errors/CapiError.js";

export interface EventDispatchContext {
  readonly tenantId: string;
  readonly correlationId: string;
}

/** Port for accumulating/flushing `CapiEvent`s into batched Meta CAPI requests (`EventBatcherService` is the only implementation). */
export interface IEventBatcher {
  /** Buffers `event`; flushes automatically once the buffer reaches `batchSize` (default 1 = immediate send). Returns the flush results, or `ok([])` while still buffered below `batchSize`. */
  add(
    event: CapiEvent,
    ctx: EventDispatchContext,
  ): Promise<Result<readonly EventResult[], CapiError>>;
  /** Sends whatever is currently buffered, regardless of `batchSize`. `ok([])` when the buffer is empty. */
  flush(ctx: EventDispatchContext): Promise<Result<readonly EventResult[], CapiError>>;
}
