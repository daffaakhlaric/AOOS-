import { describe, expect, it } from "vitest";

import { WorkflowNotFoundException } from "../../src/errors/workflow-not-found-exception.js";
import { WorkflowLoader } from "../../src/loader/workflow-loader.js";
import { definitionFixture } from "../helpers/definition-fixture.js";
import { registryFixture } from "../helpers/registry-fixture.js";

describe("Loader Test — WorkflowLoader", () => {
  it("loadByVersion() resolves an exact version", () => {
    const definition = definitionFixture({ version: "1.0.0" });
    const loader = new WorkflowLoader(registryFixture([definition]));
    expect(loader.loadByVersion("sample-workflow", "1.0.0")).toEqual(definition);
  });

  it("loadByVersion() throws WorkflowNotFoundException for an unregistered version", () => {
    const loader = new WorkflowLoader(registryFixture([definitionFixture({ version: "1.0.0" })]));
    expect(() => loader.loadByVersion("sample-workflow", "9.9.9")).toThrow(
      WorkflowNotFoundException,
    );
  });

  it("loadLatest()/loadById() resolve the highest registered version", () => {
    const v1 = definitionFixture({ version: "1.0.0" });
    const v2 = definitionFixture({ version: "2.0.0" });
    const loader = new WorkflowLoader(registryFixture([v1, v2]));
    expect(loader.loadLatest("sample-workflow").version).toBe("2.0.0");
    expect(loader.loadById("sample-workflow").version).toBe("2.0.0");
  });

  it("loadLatest() throws WorkflowNotFoundException for an unknown id", () => {
    const loader = new WorkflowLoader(registryFixture([]));
    expect(() => loader.loadLatest("ghost")).toThrow(WorkflowNotFoundException);
  });

  it("loadRegisteredVersions() lists every registered version", () => {
    const loader = new WorkflowLoader(
      registryFixture([
        definitionFixture({ version: "1.0.0" }),
        definitionFixture({ version: "1.1.0" }),
      ]),
    );
    expect(loader.loadRegisteredVersions("sample-workflow")).toEqual(["1.0.0", "1.1.0"]);
  });

  it("validateCompatibility() delegates to @aos/workflow-definition's CompatibilityChecker", () => {
    const loader = new WorkflowLoader(
      registryFixture([
        definitionFixture({ version: "1.0.0" }),
        definitionFixture({ version: "1.1.0" }),
      ]),
    );
    const result = loader.validateCompatibility("sample-workflow", "1.0.0", "1.1.0");
    expect(result.compatible).toBe(true);
  });
});
