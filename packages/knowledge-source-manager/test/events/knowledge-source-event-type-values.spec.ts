import { describe, expect, it } from "vitest";

import { KnowledgeSourceEventType } from "../../src/events/knowledge-source-event-type.js";

describe("KnowledgeSourceEventType individual values", () => {
  it("CREATED", () => expect(KnowledgeSourceEventType.CREATED).toBe("knowledge.source.created"));
  it("UPDATED", () => expect(KnowledgeSourceEventType.UPDATED).toBe("knowledge.source.updated"));
  it("DELETED", () => expect(KnowledgeSourceEventType.DELETED).toBe("knowledge.source.deleted"));
  it("ENABLED", () => expect(KnowledgeSourceEventType.ENABLED).toBe("knowledge.source.enabled"));
  it("DISABLED", () => expect(KnowledgeSourceEventType.DISABLED).toBe("knowledge.source.disabled"));
  it("REGISTERED", () =>
    expect(KnowledgeSourceEventType.REGISTERED).toBe("knowledge.source.registered"));
  it("ARCHIVED", () => expect(KnowledgeSourceEventType.ARCHIVED).toBe("knowledge.source.archived"));
  it("METRICS_UPDATED", () =>
    expect(KnowledgeSourceEventType.METRICS_UPDATED).toBe("knowledge.source.metrics.updated"));
  it("HEALTH_CHANGED", () =>
    expect(KnowledgeSourceEventType.HEALTH_CHANGED).toBe("knowledge.source.health.changed"));
});
