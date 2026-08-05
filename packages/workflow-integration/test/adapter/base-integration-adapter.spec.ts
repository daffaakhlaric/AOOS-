import { describe, expect, it } from "vitest";

import { CapabilityAdapter } from "../../src/adapter/capability-adapter.js";
import { IntegrationNamespace } from "../../src/contracts/integration-namespace.js";
import { failingRuntime, successfulRuntime, trackingRuntime } from "../helpers/runtime-fixture.js";

describe("Adapter Test — BaseIntegrationAdapter (via CapabilityAdapter)", () => {
  it("is unavailable and returns a business failure when no runtime is configured", async () => {
    const adapter = new CapabilityAdapter("no-runtime");
    expect(adapter.isAvailable()).toBe(false);
    expect(adapter.namespace).toBe(IntegrationNamespace.CAPABILITY);
    const result = await adapter.execute({ operation: "create", input: {} });
    expect(result.success).toBe(false);
    expect(result.error).toContain("no-runtime");
  });

  it("is available and delegates to the configured runtime on success", async () => {
    const adapter = new CapabilityAdapter("crm", successfulRuntime({ id: "1" }));
    expect(adapter.isAvailable()).toBe(true);
    const result = await adapter.execute({ operation: "create", input: {} });
    expect(result).toEqual({ success: true, output: { id: "1" } });
  });

  it("delegates a failing runtime's result unchanged", async () => {
    const adapter = new CapabilityAdapter("crm", failingRuntime("boom"));
    const result = await adapter.execute({ operation: "create", input: {} });
    expect(result).toEqual({ success: false, error: "boom" });
  });

  it("forwards the exact request to the underlying runtime", async () => {
    const runtime = trackingRuntime();
    const adapter = new CapabilityAdapter("crm", runtime);
    const request = { operation: "create", input: { name: "Acme" } };
    await adapter.execute(request);
    expect(runtime.calls).toEqual([request]);
  });

  it("defaults version to 1.0.0 and priority to 0", () => {
    const adapter = new CapabilityAdapter("crm", successfulRuntime());
    expect(adapter.version).toBe("1.0.0");
    expect(adapter.priority).toBe(0);
  });

  it("accepts a custom version and priority", () => {
    const adapter = new CapabilityAdapter("crm", successfulRuntime(), {
      version: "2.1.0",
      priority: 5,
    });
    expect(adapter.version).toBe("2.1.0");
    expect(adapter.priority).toBe(5);
  });

  it("exposes the Adapter name", () => {
    const adapter = new CapabilityAdapter("crm", successfulRuntime());
    expect(adapter.name).toBe("crm");
  });
});
