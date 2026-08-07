import { describe, expect, it } from "vitest";

import { KnowledgePolicyEventType } from "../../src/events/knowledge-policy-event-type.js";
import { KnowledgePolicyEvents } from "../../src/events/knowledge-policy-events.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("KnowledgePolicyEventType", () => {
  it("has exactly 10 members", () => {
    expect(Object.values(KnowledgePolicyEventType)).toHaveLength(10);
  });
});

describe("KnowledgePolicyEvents", () => {
  it("publishes an event with the context's identity fields", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgePolicyEvents(publisher);
    const context = contextFixture();
    await events.publishPolicyEvent(KnowledgePolicyEventType.POLICY_CREATED, context);
    expect(publish).toHaveBeenCalledTimes(1);
    const call = publish.mock.calls[0]?.[0];
    expect(call.type).toBe(KnowledgePolicyEventType.POLICY_CREATED);
    expect(call.tenantId).toBe(context.tenantId);
    expect(call.correlationId).toBe(context.correlationId);
    expect(call.producer).toBe("@aos/knowledge-policy");
    expect(call.payload).toMatchObject({ token: context.token, policyId: context.policyId });
  });

  it("merges extra payload fields", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgePolicyEvents(publisher);
    const context = contextFixture();
    await events.publishPolicyEvent(KnowledgePolicyEventType.POLICY_EVALUATED, context, {
      evaluationId: "eval-1",
    });
    const call = publish.mock.calls[0]?.[0];
    expect(call.payload).toMatchObject({ evaluationId: "eval-1" });
  });

  it("uses a custom source when supplied", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgePolicyEvents(publisher, "custom-source");
    await events.publishPolicyEvent(KnowledgePolicyEventType.POLICY_ACTIVATED, contextFixture());
    const call = publish.mock.calls[0]?.[0];
    expect(call.source).toBe("custom-source");
  });
});
