import { describe, expect, it } from "vitest";

import {
  capabilityManifestSchema,
  createCapabilityRegistry,
} from "../../../src/registry/kinds/capability-registry-kind.js";

describe("Schema Test — capabilityManifestSchema (005.3A Enhancement 1)", () => {
  it("accepts the full enriched shape: namespace/input_schema/output_schema/provided_by/lifecycle", () => {
    const result = capabilityManifestSchema.safeParse({
      id: "inventory.read",
      version: "1.0.0",
      category: "capability",
      description: "Read current inventory levels",
      namespace: "inventory",
      input_schema: "inventory.read.input.v1",
      output_schema: "inventory.read.output.v1",
      provided_by: ["dms-connector"],
      industry: ["automotive"],
      lifecycle: "stable",
    });
    expect(result.success).toBe(true);
  });

  it("still accepts a pre-005.3A minimal Capability manifest (backward compatible)", () => {
    const result = capabilityManifestSchema.safeParse({
      id: "marketing.generate_content",
      version: "1.0.0",
      category: "capability",
      description: "Generate marketing content",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown lifecycle value", () => {
    const result = capabilityManifestSchema.safeParse({
      id: "inventory.read",
      version: "1.0.0",
      category: "capability",
      description: "x",
      lifecycle: "beta",
    });
    expect(result.success).toBe(false);
  });
});

describe("Validation Test — Capability Registry namespace business rule", () => {
  it("registers a manifest whose id has a valid namespace", async () => {
    const registry = createCapabilityRegistry();
    const entry = await registry.register({
      id: "crm.find_customer",
      version: "1.0.0",
      category: "capability",
      description: "Find a CRM customer",
    });
    expect(entry.manifest.id).toBe("crm.find_customer");
  });

  it("rejects a manifest id with an unknown namespace", async () => {
    const registry = createCapabilityRegistry();
    await expect(
      registry.register({
        id: "bogus.doSomething",
        version: "1.0.0",
        category: "capability",
        description: "x",
      }),
    ).rejects.toThrow(/namespace/i);
  });

  it("rejects a manifest id with no namespace at all", async () => {
    const registry = createCapabilityRegistry();
    await expect(
      registry.register({
        id: "content_generation",
        version: "1.0.0",
        category: "capability",
        description: "x",
      }),
    ).rejects.toThrow(/namespace/i);
  });

  it("rejects a declared namespace that mismatches the id's own namespace", async () => {
    const registry = createCapabilityRegistry();
    await expect(
      registry.register({
        id: "inventory.read",
        version: "1.0.0",
        category: "capability",
        description: "x",
        namespace: "crm",
      }),
    ).rejects.toThrow(/does not match/i);
  });

  it("accepts a declared namespace that matches the id's own namespace", async () => {
    const registry = createCapabilityRegistry();
    const entry = await registry.register({
      id: "inventory.read",
      version: "1.0.0",
      category: "capability",
      description: "x",
      namespace: "inventory",
    });
    expect(entry.manifest.id).toBe("inventory.read");
  });
});
