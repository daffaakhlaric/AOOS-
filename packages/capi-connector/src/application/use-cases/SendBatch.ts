import type { Result } from "@aos/common";

import type { EventDispatchContext, IEventBatcher } from "../../contracts/IEventBatcher.js";
import type { EventResult } from "../../domain/entities/EventResult.js";
import type { CapiError } from "../../domain/errors/CapiError.js";

/** Explicitly flushes whatever `EventBatcherService` currently has buffered — the manual escape hatch for `batchSize > 1` configurations (spec "Batching Strategy"). A no-op (`ok([])`) when nothing is buffered. */
export class SendBatch {
  constructor(private readonly batcher: IEventBatcher) {}

  async execute(ctx: EventDispatchContext): Promise<Result<readonly EventResult[], CapiError>> {
    return this.batcher.flush(ctx);
  }
}
