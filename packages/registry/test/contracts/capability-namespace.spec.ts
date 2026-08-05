import { describe, expect, it } from "vitest";

import {
  CAPABILITY_NAMESPACES,
  extractCapabilityNamespace,
  isValidCapabilityNamespace,
} from "../../src/contracts/capability-namespace.js";

describe("Namespace Test — CAPABILITY_NAMESPACES", () => {
  it("has no duplicate namespaces", () => {
    expect(new Set(CAPABILITY_NAMESPACES).size).toBe(CAPABILITY_NAMESPACES.length);
  });

  it("contains every namespace listed in docs/PROMPT-005.3A-REGISTRY-ENHANCEMENT.md", () => {
    for (const expected of [
      "inventory",
      "crm",
      "customer",
      "sales",
      "marketing",
      "ads",
      "social",
      "calendar",
      "communication",
      "workflow",
      "reasoning",
      "planning",
      "analytics",
      "memory",
      "knowledge",
      "permission",
      "tool",
      "connector",
      "dashboard",
      "system",
      "tenant",
    ]) {
      expect(CAPABILITY_NAMESPACES).toContain(expected);
    }
  });
});

describe("Namespace Test — extractCapabilityNamespace", () => {
  it("returns the segment before the first dot", () => {
    expect(extractCapabilityNamespace("inventory.read")).toBe("inventory");
    expect(extractCapabilityNamespace("crm.findCustomer")).toBe("crm");
  });

  it("returns the whole string when there is no dot", () => {
    expect(extractCapabilityNamespace("inventory")).toBe("inventory");
  });
});

describe("Namespace Test — isValidCapabilityNamespace", () => {
  it("accepts every example capability from the source prompt", () => {
    for (const id of [
      "inventory.read",
      "inventory.update",
      "crm.findCustomer",
      "crm.createLead",
      "marketing.generateContent",
      "marketing.publish",
      "ads.createCampaign",
      "ads.optimizeCampaign",
      "calendar.createEvent",
    ]) {
      expect(isValidCapabilityNamespace(id)).toBe(true);
    }
  });

  it("rejects an id whose namespace is not in CAPABILITY_NAMESPACES", () => {
    expect(isValidCapabilityNamespace("bogus.doSomething")).toBe(false);
  });

  it("rejects an id with no namespace at all", () => {
    expect(isValidCapabilityNamespace("content_generation")).toBe(false);
  });
});
