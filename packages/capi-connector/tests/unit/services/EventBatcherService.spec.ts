import { err, ok } from "@aos/common";
import { describe, expect, it } from "vitest";

import { EventBatcherService } from "../../../src/application/services/EventBatcherService.js";
import { CapiEvent } from "../../../src/domain/entities/CapiEvent.js";
import { CapiApiError } from "../../../src/domain/errors/CapiApiError.js";
import { CapiConnectorEvents } from "../../../src/domain/events/CapiConnectorEvents.js";
import { ActionSource } from "../../../src/domain/value-objects/ActionSource.js";
import { EventName } from "../../../src/domain/value-objects/EventName.js";
import { EventSourceUrl } from "../../../src/domain/value-objects/EventSourceUrl.js";
import { EventTime } from "../../../src/domain/value-objects/EventTime.js";
import { HashedPhone } from "../../../src/domain/value-objects/HashedPhone.js";
import { ExponentialBackoffRetry } from "../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { createFakeCapiClient } from "../../helpers/capi-client.js";
import { buildConfig } from "../../helpers/config.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function makeEvent(): CapiEvent {
  return unwrap(
    CapiEvent.create({
      eventName: EventName.CONTACT,
      eventTime: unwrap(EventTime.fromDate(new Date("2024-08-09T14:03:00.000Z"))),
      eventSourceUrl: unwrap(EventSourceUrl.create("https://mobixbydss.id")),
      actionSource: ActionSource.website(),
      userData: {
        ph: [unwrap(HashedPhone.create("a".repeat(64)))],
        country: ["x"],
        clientUserAgent: "",
      },
    }),
  );
}

const ctx = { tenantId: "t1", correlationId: "c1" };

describe("EventBatcherService", () => {
  it("batchSize=1 (default): add() sends immediately and publishes EventSent + BatchCompleted", async () => {
    const client = createFakeCapiClient({
      sendEventsResult: ok({ eventsReceived: 1, fbtraceId: "trace-1" }),
    });
    const publisher = createFakePublisher();
    const events = new CapiConnectorEvents(publisher);
    const retry = new ExponentialBackoffRetry({ sleep: async () => undefined });
    const batcher = new EventBatcherService(
      buildConfig({ batchSize: 1 }),
      client,
      retry,
      events,
      () => new Date(),
    );

    const result = unwrap(await batcher.add(makeEvent(), ctx));
    expect(result).toEqual([{ eventName: EventName.CONTACT, success: true, fbtraceId: "trace-1" }]);
    expect(client.sendEvents).toHaveBeenCalledTimes(1);
    expect(publisher.published.some((p) => p.type === "aaos.capi-connector.event.sent")).toBe(true);
    expect(publisher.published.some((p) => p.type === "aaos.capi-connector.batch.completed")).toBe(
      true,
    );
  });

  it("batchSize=2: first add() buffers (pending), second add() flushes both", async () => {
    const client = createFakeCapiClient({ sendEventsResult: ok({ eventsReceived: 2 }) });
    const publisher = createFakePublisher();
    const events = new CapiConnectorEvents(publisher);
    const retry = new ExponentialBackoffRetry({ sleep: async () => undefined });
    const batcher = new EventBatcherService(
      buildConfig({ batchSize: 2 }),
      client,
      retry,
      events,
      () => new Date(),
    );

    const first = unwrap(await batcher.add(makeEvent(), ctx));
    expect(first).toEqual([]);
    expect(client.sendEvents).not.toHaveBeenCalled();

    const second = unwrap(await batcher.add(makeEvent(), ctx));
    expect(second).toHaveLength(2);
    expect(client.sendEvents).toHaveBeenCalledTimes(1);
  });

  it("flush() with an empty buffer is a no-op returning ok([])", async () => {
    const client = createFakeCapiClient();
    const events = new CapiConnectorEvents(createFakePublisher());
    const retry = new ExponentialBackoffRetry({ sleep: async () => undefined });
    const batcher = new EventBatcherService(buildConfig(), client, retry, events, () => new Date());
    const result = unwrap(await batcher.flush(ctx));
    expect(result).toEqual([]);
    expect(client.sendEvents).not.toHaveBeenCalled();
  });

  it("on send failure, publishes EventFailed + BatchCompleted(failureCount) and returns err", async () => {
    const client = createFakeCapiClient({
      sendEventsResult: err(new CapiApiError("boom", { httpStatus: 400 })),
    });
    const publisher = createFakePublisher();
    const events = new CapiConnectorEvents(publisher);
    const retry = new ExponentialBackoffRetry({ sleep: async () => undefined, maxAttempts: 1 });
    const batcher = new EventBatcherService(
      buildConfig({ batchSize: 1 }),
      client,
      retry,
      events,
      () => new Date(),
    );

    const error = unwrapErr(await batcher.add(makeEvent(), ctx));
    expect(error.message).toBe("boom");

    const failedEvent = publisher.published.find(
      (p) => p.type === "aaos.capi-connector.event.failed",
    );
    expect(failedEvent?.payload).toMatchObject({ errorMessage: "boom" });
    const batchCompleted = publisher.published.find(
      (p) => p.type === "aaos.capi-connector.batch.completed",
    );
    expect(batchCompleted?.payload).toMatchObject({
      batchSize: 1,
      successCount: 0,
      failureCount: 1,
    });
  });

  it("propagates a BatchError when the buffer exceeds CapiBatch's max size (1000)", async () => {
    const client = createFakeCapiClient();
    const events = new CapiConnectorEvents(createFakePublisher());
    const retry = new ExponentialBackoffRetry({ sleep: async () => undefined });
    // batchSize beyond CapiBatch's own MAX_BATCH_SIZE (1000) is unreachable through
    // parseCapiConnectorConfig's own Zod max(1000), but this test constructs the config
    // object directly (bypassing Zod) to exercise EventBatcherService's own defensive
    // CapiBatch.create() failure path.
    const config = buildConfig({ batchSize: 1001 });
    const batcher = new EventBatcherService(config, client, retry, events, () => new Date());

    let lastResult: Awaited<ReturnType<typeof batcher.add>> | undefined;
    for (let i = 0; i < 1001; i += 1) {
      lastResult = await batcher.add(makeEvent(), ctx);
    }
    expect(lastResult).toBeDefined();
    const error = unwrapErr(lastResult!);
    expect(error.name).toBe("BatchError");
    expect(client.sendEvents).not.toHaveBeenCalled();
  });
});
