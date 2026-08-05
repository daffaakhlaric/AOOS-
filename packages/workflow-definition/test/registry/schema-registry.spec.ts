import { describe, expect, it } from "vitest";
import { z } from "zod";

import { RegistryException } from "../../src/errors/registry-exception.js";
import { SchemaRegistry } from "../../src/registry/schema-registry.js";

describe("Registry Test — SchemaRegistry", () => {
  it("registers and retrieves a schema by name", () => {
    const registry = new SchemaRegistry();
    const schema = z.object({ foo: z.string() });
    registry.register("custom.event", schema);
    expect(registry.get("custom.event")).toBe(schema);
    expect(registry.has("custom.event")).toBe(true);
    expect(registry.list()).toEqual(["custom.event"]);
  });

  it("throws RegistryException when registering a duplicate name", () => {
    const registry = new SchemaRegistry();
    registry.register("dup", z.string());
    expect(() => registry.register("dup", z.number())).toThrow(RegistryException);
  });

  it("returns undefined and false for an unknown schema", () => {
    const registry = new SchemaRegistry();
    expect(registry.get("ghost")).toBeUndefined();
    expect(registry.has("ghost")).toBe(false);
  });

  it("unregisters a schema", () => {
    const registry = new SchemaRegistry();
    registry.register("temp", z.string());
    registry.unregister("temp");
    expect(registry.has("temp")).toBe(false);
  });

  it("throws RegistryException when unregistering an unknown schema", () => {
    const registry = new SchemaRegistry();
    expect(() => registry.unregister("ghost")).toThrow(RegistryException);
  });
});
