import { describe, expect, it } from "vitest";

import { KnowledgeValidatorEventType } from "../../src/events/knowledge-validator-event-type.js";
import { KnowledgeValidatorEvents } from "../../src/events/knowledge-validator-events.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/event-publisher-fixture.js";

describe("KnowledgeValidatorEventType", () => {
  it("has exactly 11 event types", () => {
    expect(Object.values(KnowledgeValidatorEventType)).toHaveLength(11);
  });

  it.each([
    ["VALIDATION_CREATED", "knowledge.validation.created"],
    ["VALIDATION_QUEUED", "knowledge.validation.queued"],
    ["VALIDATION_STARTED", "knowledge.validation.started"],
    ["VALIDATION_COMPLETED", "knowledge.validation.completed"],
    ["VALIDATION_APPROVED", "knowledge.validation.approved"],
    ["VALIDATION_REJECTED", "knowledge.validation.rejected"],
    ["VALIDATION_CANCELLED", "knowledge.validation.cancelled"],
    ["VALIDATION_ARCHIVED", "knowledge.validation.archived"],
    ["VALIDATION_DESTROYED", "knowledge.validation.destroyed"],
    ["DECISION_CREATED", "knowledge.validation.decision.created"],
    ["REPORT_GENERATED", "knowledge.validation.report.generated"],
  ])("has %s = %s", (key, value) => {
    expect(KnowledgeValidatorEventType[key as keyof typeof KnowledgeValidatorEventType]).toBe(
      value,
    );
  });
});

describe("KnowledgeValidatorEvents", () => {
  it("publishes with the correct producer", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeValidatorEvents(publisher);
    await events.publishValidatorEvent(
      KnowledgeValidatorEventType.VALIDATION_CREATED,
      contextFixture(),
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ producer: "@aos/knowledge-validator" }),
    );
  });

  it("carries the context's token/tenantId/correlationId", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeValidatorEvents(publisher);
    const context = contextFixture({ tenantId: "tenant-9" });
    await events.publishValidatorEvent(KnowledgeValidatorEventType.VALIDATION_QUEUED, context);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-9",
        correlationId: context.correlationId,
        payload: expect.objectContaining({ token: context.token }),
      }),
    );
  });

  it("merges extra payload fields", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeValidatorEvents(publisher);
    await events.publishValidatorEvent(
      KnowledgeValidatorEventType.DECISION_CREATED,
      contextFixture(),
      { decisionId: "d-1" },
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ decisionId: "d-1" }) }),
    );
  });

  it("uses the default source when none is supplied", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeValidatorEvents(publisher);
    await events.publishValidatorEvent(
      KnowledgeValidatorEventType.VALIDATION_STARTED,
      contextFixture(),
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ source: "knowledge-validator" }),
    );
  });

  it("honors a custom source", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeValidatorEvents(publisher, "custom-source");
    await events.publishValidatorEvent(
      KnowledgeValidatorEventType.VALIDATION_STARTED,
      contextFixture(),
    );
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ source: "custom-source" }));
  });
});
