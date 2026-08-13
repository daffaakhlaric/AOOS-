import { describe, expect, it } from "vitest";

import { CapiBatch, MAX_BATCH_SIZE } from "../../../../src/domain/entities/CapiBatch.js";
import { CapiEvent } from "../../../../src/domain/entities/CapiEvent.js";
import { ActionSource } from "../../../../src/domain/value-objects/ActionSource.js";
import { EventName } from "../../../../src/domain/value-objects/EventName.js";
import { EventSourceUrl } from "../../../../src/domain/value-objects/EventSourceUrl.js";
import { EventTime } from "../../../../src/domain/value-objects/EventTime.js";
import { HashedPhone } from "../../../../src/domain/value-objects/HashedPhone.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

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

describe("CapiBatch", () => {
  it("MAX_BATCH_SIZE is Meta's documented cap", () => {
    expect(MAX_BATCH_SIZE).toBe(1000);
  });

  it("creates a batch from 1 event", () => {
    const batch = unwrap(CapiBatch.create([makeEvent()]));
    expect(batch.size).toBe(1);
    expect(batch.events).toHaveLength(1);
  });

  it("creates a batch from exactly MAX_BATCH_SIZE events", () => {
    const events = Array.from({ length: MAX_BATCH_SIZE }, () => makeEvent());
    const batch = unwrap(CapiBatch.create(events));
    expect(batch.size).toBe(MAX_BATCH_SIZE);
  });

  it("rejects an empty array", () => {
    const error = unwrapErr(CapiBatch.create([]));
    expect(error.message).toContain("CapiBatch must contain at least one event");
  });

  it("rejects more than MAX_BATCH_SIZE events", () => {
    const events = Array.from({ length: MAX_BATCH_SIZE + 1 }, () => makeEvent());
    const error = unwrapErr(CapiBatch.create(events));
    expect(error.message).toContain(`CapiBatch must not exceed ${MAX_BATCH_SIZE} events`);
  });

  it("is defensively copied — mutating the input array after create() doesn't affect the batch", () => {
    const events = [makeEvent()];
    const batch = unwrap(CapiBatch.create(events));
    events.push(makeEvent());
    expect(batch.size).toBe(1);
  });
});
