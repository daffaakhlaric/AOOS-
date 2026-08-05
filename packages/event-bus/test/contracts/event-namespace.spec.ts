import { describe, expect, it } from "vitest";

import {
  EVENT_NAMESPACES,
  extractEventNamespace,
  isValidEventNamespace,
} from "../../src/contracts/event-namespace.js";

describe("Namespace Test — EVENT_NAMESPACES", () => {
  it("has no duplicate namespaces", () => {
    expect(new Set(EVENT_NAMESPACES).size).toBe(EVENT_NAMESPACES.length);
  });

  it("contains every namespace listed in docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md, including the capability.* addendum", () => {
    for (const expected of [
      "agent",
      "workflow",
      "tool",
      "registry",
      "scheduler",
      "memory",
      "planning",
      "reasoning",
      "reflection",
      "analytics",
      "simulation",
      "tenant",
      "system",
      "audit",
      "monitoring",
      "capability",
    ]) {
      expect(EVENT_NAMESPACES).toContain(expected);
    }
  });
});

describe("Namespace Test — extractEventNamespace", () => {
  it("returns the segment before the first dot", () => {
    expect(extractEventNamespace("agent.created")).toBe("agent");
    expect(extractEventNamespace("capability.resolved")).toBe("capability");
  });

  it("returns the whole string when there is no dot", () => {
    expect(extractEventNamespace("agent")).toBe("agent");
  });
});

describe("Namespace Test — isValidEventNamespace", () => {
  it("accepts the capability.* addendum examples", () => {
    for (const type of ["capability.resolved", "capability.failed", "capability.deprecated"]) {
      expect(isValidEventNamespace(type)).toBe(true);
    }
  });

  it("rejects an unknown namespace", () => {
    expect(isValidEventNamespace("bogus.thing")).toBe(false);
  });
});
