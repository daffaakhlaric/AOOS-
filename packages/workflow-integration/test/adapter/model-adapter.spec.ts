import { describe, expect, it } from "vitest";

import { ModelAdapter } from "../../src/adapter/model-adapter.js";
import { IntegrationNamespace } from "../../src/contracts/integration-namespace.js";
import { failingRuntime, successfulRuntime } from "../helpers/runtime-fixture.js";

describe("Adapter Test — ModelAdapter", () => {
  it("declares the MODEL namespace", () => {
    const adapter = new ModelAdapter("router");
    expect(adapter.namespace).toBe(IntegrationNamespace.MODEL);
  });

  it("is unavailable and returns a business failure with neither runtime configured", async () => {
    const adapter = new ModelAdapter("router");
    expect(adapter.isAvailable()).toBe(false);
    const result = await adapter.execute({ operation: "route", input: {} });
    expect(result.success).toBe(false);
    expect(result.error).toContain("router");
  });

  it("prefers modelRouter when both modelRouter and aiGateway are configured", async () => {
    const adapter = new ModelAdapter("router", {
      modelRouter: successfulRuntime({ via: "router" }),
      aiGateway: successfulRuntime({ via: "gateway" }),
    });
    const result = await adapter.execute({ operation: "route", input: {} });
    expect(result).toEqual({ success: true, output: { via: "router" } });
  });

  it("falls back to aiGateway when modelRouter is not configured", async () => {
    const adapter = new ModelAdapter("router", {
      aiGateway: successfulRuntime({ via: "gateway" }),
    });
    expect(adapter.isAvailable()).toBe(true);
    const result = await adapter.execute({ operation: "route", input: {} });
    expect(result).toEqual({ success: true, output: { via: "gateway" } });
  });

  it("propagates a failing modelRouter result unchanged", async () => {
    const adapter = new ModelAdapter("router", { modelRouter: failingRuntime("router down") });
    const result = await adapter.execute({ operation: "route", input: {} });
    expect(result).toEqual({ success: false, error: "router down" });
  });

  it("accepts a custom version and priority", () => {
    const adapter = new ModelAdapter("router", {}, { version: "3.0.0", priority: 7 });
    expect(adapter.version).toBe("3.0.0");
    expect(adapter.priority).toBe(7);
  });
});
