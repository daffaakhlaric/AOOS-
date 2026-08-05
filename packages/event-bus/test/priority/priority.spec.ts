import { describe, expect, it } from "vitest";

import { EventPriority } from "../../src/contracts/event-priority.js";
import { comparePriority, priorityRank } from "../../src/priority/priority-comparator.js";
import { PriorityResolver } from "../../src/priority/priority-resolver.js";

describe("Priority Test — priorityRank / comparePriority", () => {
  it("ranks Critical as most urgent (0) and Background as least (4)", () => {
    expect(priorityRank(EventPriority.CRITICAL)).toBe(0);
    expect(priorityRank(EventPriority.BACKGROUND)).toBe(4);
  });

  it("comparePriority sorts most urgent first", () => {
    const sorted = [EventPriority.LOW, EventPriority.CRITICAL, EventPriority.NORMAL].sort(
      comparePriority,
    );
    expect(sorted).toEqual([EventPriority.CRITICAL, EventPriority.NORMAL, EventPriority.LOW]);
  });
});

describe("Priority Test — PriorityResolver", () => {
  it("resolves the built-in namespace defaults", () => {
    const resolver = new PriorityResolver();
    expect(resolver.resolve("system")).toBe(EventPriority.CRITICAL);
    expect(resolver.resolve("audit")).toBe(EventPriority.HIGH);
    expect(resolver.resolve("analytics")).toBe(EventPriority.LOW);
    expect(resolver.resolve("monitoring")).toBe(EventPriority.BACKGROUND);
  });

  it("falls back to Normal for an unmapped namespace", () => {
    expect(new PriorityResolver().resolve("agent")).toBe(EventPriority.NORMAL);
  });

  it("accepts caller overrides that take precedence over the built-in defaults", () => {
    const resolver = new PriorityResolver({ agent: EventPriority.HIGH });
    expect(resolver.resolve("agent")).toBe(EventPriority.HIGH);
  });
});
