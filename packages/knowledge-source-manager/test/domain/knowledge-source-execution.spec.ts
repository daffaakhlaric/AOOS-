import { describe, expect, it } from "vitest";

import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgeSourceExecution shape", () => {
  it("carries instance/context/metadata/configuration/history together", () => {
    const execution = executionFixture();
    expect(execution).toHaveProperty("instance");
    expect(execution).toHaveProperty("context");
    expect(execution).toHaveProperty("metadata");
    expect(execution).toHaveProperty("configuration");
    expect(execution).toHaveProperty("history");
    expect(execution.history).toEqual([]);
  });
});
