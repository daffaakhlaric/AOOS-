import { describe, expect, it } from "vitest";

import { KnowledgeSource } from "../../src/source/knowledge-source.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgeSource", () => {
  it("exposes id/token/sourceId/category/providerId/state from its execution", () => {
    const execution = executionFixture();
    const source = new KnowledgeSource(execution);
    expect(source.id).toBe(execution.instance.id);
    expect(source.token).toBe(execution.instance.token);
    expect(source.sourceId).toBe(execution.metadata.sourceId);
    expect(source.category).toBe(execution.metadata.sourceCategory);
    expect(source.providerId).toBe(execution.metadata.providerId);
    expect(source.state).toBe(execution.instance.state);
  });

  it("exposes metadata/configuration/context/history", () => {
    const execution = executionFixture();
    const source = new KnowledgeSource(execution);
    expect(source.metadata).toBe(execution.metadata);
    expect(source.configuration).toBe(execution.configuration);
    expect(source.context).toBe(execution.context);
    expect(source.history).toBe(execution.history);
  });

  it("toExecution returns the underlying execution", () => {
    const execution = executionFixture();
    const source = new KnowledgeSource(execution);
    expect(source.toExecution()).toBe(execution);
  });
});
