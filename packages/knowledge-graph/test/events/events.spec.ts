import { describe, expect, it, vi } from "vitest";

import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { KnowledgeGraphEventType } from "../../src/events/knowledge-graph-event-type.js";
import { NoOpEventPublisher } from "../../src/events/no-op-event-publisher.js";

const EXPECTED_EVENT_TYPES = [
  "GraphCreated",
  "GraphDeleted",
  "NodeCreated",
  "NodeUpdated",
  "NodeDeleted",
  "EdgeCreated",
  "EdgeDeleted",
  "RelationshipCreated",
  "RelationshipDeleted",
  "TraversalExecuted",
  "GraphValidated",
  "SnapshotCreated",
  "GraphMerged",
];

describe("KnowledgeGraphEventType", () => {
  it("has exactly the 13 catalogued event types", () => {
    expect(Object.keys(KnowledgeGraphEventType)).toHaveLength(13);
    expect(Object.keys(KnowledgeGraphEventType).sort()).toEqual([...EXPECTED_EVENT_TYPES].sort());
  });

  it("every value is namespaced under knowledge.graph.", () => {
    for (const value of Object.values(KnowledgeGraphEventType)) {
      expect(value.startsWith("knowledge.graph.")).toBe(true);
    }
  });
});

describe("InMemoryEventPublisher", () => {
  it("publish() records history and invokes registered handlers for that eventType", () => {
    const publisher = new InMemoryEventPublisher();
    const handler = vi.fn();
    publisher.on(KnowledgeGraphEventType.GraphCreated, handler);
    publisher.publish(KnowledgeGraphEventType.GraphCreated, { id: "g1" });

    expect(handler).toHaveBeenCalledWith({ id: "g1" });
    expect(publisher.getHistory()).toHaveLength(1);
    expect(publisher.getHistory()[0]?.eventType).toBe(KnowledgeGraphEventType.GraphCreated);
  });

  it("does not invoke handlers registered for a different eventType", () => {
    const publisher = new InMemoryEventPublisher();
    const handler = vi.fn();
    publisher.on(KnowledgeGraphEventType.GraphCreated, handler);
    publisher.publish(KnowledgeGraphEventType.GraphDeleted, { id: "g1" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("on() returns an unsubscribe function", () => {
    const publisher = new InMemoryEventPublisher();
    const handler = vi.fn();
    const unsubscribe = publisher.on(KnowledgeGraphEventType.GraphCreated, handler);
    unsubscribe();
    publisher.publish(KnowledgeGraphEventType.GraphCreated, {});
    expect(handler).not.toHaveBeenCalled();
  });

  it("supports multiple handlers for the same eventType", () => {
    const publisher = new InMemoryEventPublisher();
    const first = vi.fn();
    const second = vi.fn();
    publisher.on(KnowledgeGraphEventType.GraphCreated, first);
    publisher.on(KnowledgeGraphEventType.GraphCreated, second);
    publisher.publish(KnowledgeGraphEventType.GraphCreated, {});
    expect(first).toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });

  it("publishing with no registered handlers does not throw", () => {
    const publisher = new InMemoryEventPublisher();
    expect(() => publisher.publish(KnowledgeGraphEventType.GraphCreated, {})).not.toThrow();
  });

  it("clearHistory() empties the recorded history", () => {
    const publisher = new InMemoryEventPublisher();
    publisher.publish(KnowledgeGraphEventType.GraphCreated, {});
    publisher.clearHistory();
    expect(publisher.getHistory()).toHaveLength(0);
  });
});

describe("NoOpEventPublisher", () => {
  it("publish() does nothing and never throws", () => {
    const publisher = new NoOpEventPublisher();
    expect(() => publisher.publish(KnowledgeGraphEventType.GraphCreated, { a: 1 })).not.toThrow();
  });
});
