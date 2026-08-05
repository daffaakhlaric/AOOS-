import { describe, expect, it } from "vitest";

import { ConfigRegistry } from "../src/config-registry.js";

describe("ConfigRegistry", () => {
  it("registers and retrieves a named section", () => {
    const registry = new ConfigRegistry();
    registry.register("database", { host: "localhost", port: 5432 });
    expect(registry.get<{ host: string; port: number }>("database")).toEqual({
      host: "localhost",
      port: 5432,
    });
  });

  it("throws when registering the same section name twice", () => {
    const registry = new ConfigRegistry();
    registry.register("cache", {});
    expect(() => registry.register("cache", {})).toThrow(/already registered/);
  });

  it("throws when getting an unregistered section", () => {
    const registry = new ConfigRegistry();
    expect(() => registry.get("missing")).toThrow(/has not been registered/);
  });

  it("has() reports registration status without throwing", () => {
    const registry = new ConfigRegistry();
    expect(registry.has("x")).toBe(false);
    registry.register("x", 1);
    expect(registry.has("x")).toBe(true);
  });
});
