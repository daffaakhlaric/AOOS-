import { describe, expect, it, vi } from "vitest";

import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { KnowledgeGraphEventType } from "../../src/events/knowledge-graph-event-type.js";

describe("InMemoryEventPublisher — additional coverage", () => {
  it("history preserves publish order across different event types", () => {
    const publisher = new InMemoryEventPublisher();
    publisher.publish(KnowledgeGraphEventType.GraphCreated, { seq: 1 });
    publisher.publish(KnowledgeGraphEventType.NodeCreated, { seq: 2 });
    publisher.publish(KnowledgeGraphEventType.EdgeCreated, { seq: 3 });
    expect(publisher.getHistory().map((entry) => entry.payload)).toEqual([
      { seq: 1 },
      { seq: 2 },
      { seq: 3 },
    ]);
  });

  it("unsubscribing one handler does not affect another handler on the same eventType", () => {
    const publisher = new InMemoryEventPublisher();
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = publisher.on(KnowledgeGraphEventType.GraphCreated, first);
    publisher.on(KnowledgeGraphEventType.GraphCreated, second);
    unsubscribeFirst();
    publisher.publish(KnowledgeGraphEventType.GraphCreated, {});
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("each recorded history entry carries a publishedAt timestamp", () => {
    const publisher = new InMemoryEventPublisher();
    publisher.publish(KnowledgeGraphEventType.GraphCreated, {});
    expect(typeof publisher.getHistory()[0]?.publishedAt).toBe("number");
  });
});
