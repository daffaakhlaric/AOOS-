import { describe, expect, it } from "vitest";

import { AgentAdapter } from "../../src/adapter/agent-adapter.js";
import { ConnectorAdapter } from "../../src/adapter/connector-adapter.js";
import { ExperienceAdapter } from "../../src/adapter/experience-adapter.js";
import { KnowledgeAdapter } from "../../src/adapter/knowledge-adapter.js";
import { MemoryAdapter } from "../../src/adapter/memory-adapter.js";
import { PromptAdapter } from "../../src/adapter/prompt-adapter.js";
import { ToolAdapter } from "../../src/adapter/tool-adapter.js";
import { IntegrationNamespace } from "../../src/contracts/integration-namespace.js";
import { successfulRuntime } from "../helpers/runtime-fixture.js";

describe("Adapter Test — concrete Adapters", () => {
  it.each([
    ["ToolAdapter", ToolAdapter, IntegrationNamespace.TOOL],
    ["ConnectorAdapter", ConnectorAdapter, IntegrationNamespace.CONNECTOR],
    ["KnowledgeAdapter", KnowledgeAdapter, IntegrationNamespace.KNOWLEDGE],
    ["MemoryAdapter", MemoryAdapter, IntegrationNamespace.MEMORY],
    ["PromptAdapter", PromptAdapter, IntegrationNamespace.PROMPT],
    ["AgentAdapter", AgentAdapter, IntegrationNamespace.AGENT],
    ["ExperienceAdapter", ExperienceAdapter, IntegrationNamespace.EXPERIENCE],
  ] as const)(
    "%s declares the correct namespace and delegates when a runtime is configured",
    async (_name, AdapterClass, namespace) => {
      const adapter = new (
        AdapterClass as new (name: string, runtime?: unknown) => InstanceType<typeof AdapterClass>
      )("test-adapter", successfulRuntime({ ok: true }));
      expect(adapter.namespace).toBe(namespace);
      expect(adapter.isAvailable()).toBe(true);
      const result = await adapter.execute({ operation: "run", input: {} });
      expect(result).toEqual({ success: true, output: { ok: true } });
    },
  );

  it.each([
    ["ToolAdapter", ToolAdapter],
    ["ConnectorAdapter", ConnectorAdapter],
    ["KnowledgeAdapter", KnowledgeAdapter],
    ["MemoryAdapter", MemoryAdapter],
    ["PromptAdapter", PromptAdapter],
    ["AgentAdapter", AgentAdapter],
    ["ExperienceAdapter", ExperienceAdapter],
  ] as const)("%s is unavailable with no runtime configured", (_name, AdapterClass) => {
    const adapter = new (AdapterClass as new (name: string) => InstanceType<typeof AdapterClass>)(
      "test-adapter",
    );
    expect(adapter.isAvailable()).toBe(false);
  });
});
