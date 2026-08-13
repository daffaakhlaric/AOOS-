import { err, ok, type Result } from "@aos/common";

import type { CapiConnectorConfig } from "../../config/CapiConnectorConfig.js";
import type { ICapiClient } from "../../contracts/ICapiClient.js";
import type { EventDispatchContext, IEventBatcher } from "../../contracts/IEventBatcher.js";
import { CapiBatch } from "../../domain/entities/CapiBatch.js";
import type { CapiEvent } from "../../domain/entities/CapiEvent.js";
import type { EventResult } from "../../domain/entities/EventResult.js";
import type { CapiError } from "../../domain/errors/CapiError.js";
import type { CapiConnectorEvents } from "../../domain/events/CapiConnectorEvents.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";

/**
 * Accumulates `CapiEvent`s and flushes them as one `CapiBatch` per the spec's "Batching
 * Strategy": MVP default is `batchSize = 1` (immediate send); a larger `batchSize` buffers
 * until the threshold is reached or `flush()` is called explicitly (`SendBatch` use case).
 * `flushIntervalMs`-based timer flushing is out of scope for this MVP, per the spec's own
 * "Future: accumulate over 30s window" note.
 */
export class EventBatcherService implements IEventBatcher {
  private buffer: CapiEvent[] = [];

  constructor(
    private readonly config: CapiConnectorConfig,
    private readonly client: ICapiClient,
    private readonly retry: ExponentialBackoffRetry,
    private readonly events: CapiConnectorEvents,
    private readonly now: () => Date,
  ) {}

  async add(
    event: CapiEvent,
    ctx: EventDispatchContext,
  ): Promise<Result<readonly EventResult[], CapiError>> {
    this.buffer.push(event);
    if (this.buffer.length < this.config.batchSize) {
      return ok([]);
    }
    return this.flush(ctx);
  }

  async flush(ctx: EventDispatchContext): Promise<Result<readonly EventResult[], CapiError>> {
    if (this.buffer.length === 0) {
      return ok([]);
    }
    const batchResult = CapiBatch.create(this.buffer);
    this.buffer = [];
    if (!batchResult.ok) {
      return err(batchResult.error);
    }
    const batch = batchResult.value;

    const sendResult = await this.retry.execute(() => this.client.sendEvents(batch, this.config));
    const occurredAt = this.now();

    if (!sendResult.ok) {
      const results: EventResult[] = batch.events.map((event) => ({
        eventName: event.eventName,
        success: false,
        errorMessage: sendResult.error.message,
      }));
      for (const result of results) {
        await this.events.publishEventFailed({
          eventName: result.eventName,
          errorMessage: sendResult.error.message,
          tenantId: ctx.tenantId,
          correlationId: ctx.correlationId,
          occurredAt,
          version: "1.0",
        });
      }
      await this.events.publishBatchCompleted({
        batchSize: batch.size,
        successCount: 0,
        failureCount: batch.size,
        tenantId: ctx.tenantId,
        correlationId: ctx.correlationId,
        occurredAt,
        version: "1.0",
      });
      return err(sendResult.error);
    }

    const results: EventResult[] = batch.events.map((event) => ({
      eventName: event.eventName,
      success: true,
      fbtraceId: sendResult.value.fbtraceId,
    }));
    for (const result of results) {
      await this.events.publishEventSent({
        eventName: result.eventName,
        fbtraceId: result.fbtraceId,
        tenantId: ctx.tenantId,
        correlationId: ctx.correlationId,
        occurredAt,
        version: "1.0",
      });
    }
    await this.events.publishBatchCompleted({
      batchSize: batch.size,
      successCount: batch.size,
      failureCount: 0,
      tenantId: ctx.tenantId,
      correlationId: ctx.correlationId,
      occurredAt,
      version: "1.0",
    });
    return ok(results);
  }
}
