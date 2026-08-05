import { describe, expect, it } from "vitest";

import { withIntegrationResult } from "../../src/context/with-integration-result.js";
import { IntegrationNamespace } from "../../src/contracts/integration-namespace.js";
import { contextFixture } from "../helpers/context-fixture.js";

describe("Context Test — withIntegrationResult", () => {
  it("sets capabilityResult for IntegrationNamespace.CAPABILITY", () => {
    const context = contextFixture();
    const result = { success: true, output: { id: "1" } };
    const updated = withIntegrationResult(context, IntegrationNamespace.CAPABILITY, result);
    expect(updated.capabilityResult).toEqual(result);
    expect(context.capabilityResult).toBeUndefined();
  });

  it.each([
    [IntegrationNamespace.TOOL, "toolResult"],
    [IntegrationNamespace.CONNECTOR, "connectorResult"],
    [IntegrationNamespace.KNOWLEDGE, "knowledgeResult"],
    [IntegrationNamespace.MEMORY, "memoryResult"],
    [IntegrationNamespace.PROMPT, "promptResult"],
    [IntegrationNamespace.MODEL, "modelResult"],
    [IntegrationNamespace.AGENT, "agentResult"],
  ] as const)("sets %s onto field %s", (namespace, field) => {
    const context = contextFixture();
    const result = { success: true };
    const updated = withIntegrationResult(context, namespace, result);
    expect(updated[field]).toEqual(result);
  });

  it("leaves the Context unchanged for IntegrationNamespace.EXPERIENCE (no dedicated slot)", () => {
    const context = contextFixture();
    const updated = withIntegrationResult(context, IntegrationNamespace.EXPERIENCE, {
      success: true,
    });
    expect(updated).toEqual(context);
  });
});
