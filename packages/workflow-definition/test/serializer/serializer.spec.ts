import { describe, expect, it } from "vitest";

import { JsonWorkflowDefinitionParser } from "../../src/parser/json-parser.js";
import { YamlWorkflowDefinitionParser } from "../../src/parser/yaml-parser.js";
import { JsonWorkflowDefinitionSerializer } from "../../src/serializer/json-serializer.js";
import { YamlWorkflowDefinitionSerializer } from "../../src/serializer/yaml-serializer.js";
import { workflowFixture } from "../helpers/workflow-fixture.js";

describe("Serializer Test — JsonWorkflowDefinitionSerializer", () => {
  it("round-trips a Workflow Definition through JSON — Import/Export Flow", () => {
    const workflow = workflowFixture();
    const serializer = new JsonWorkflowDefinitionSerializer();
    const parser = new JsonWorkflowDefinitionParser();
    expect(parser.parse(serializer.serialize(workflow))).toEqual(workflow);
  });

  it("reports its format as json", () => {
    expect(new JsonWorkflowDefinitionSerializer().format).toBe("json");
  });

  it("produces pretty-printed JSON", () => {
    const output = new JsonWorkflowDefinitionSerializer().serialize(workflowFixture());
    expect(output).toContain("\n");
  });
});

describe("Serializer Test — YamlWorkflowDefinitionSerializer", () => {
  it("round-trips a Workflow Definition through YAML — Import/Export Flow", () => {
    const workflow = workflowFixture();
    const serializer = new YamlWorkflowDefinitionSerializer();
    const parser = new YamlWorkflowDefinitionParser();
    expect(parser.parse(serializer.serialize(workflow))).toEqual(workflow);
  });

  it("reports its format as yaml", () => {
    expect(new YamlWorkflowDefinitionSerializer().format).toBe("yaml");
  });

  it("produces human-readable YAML (no JSON braces)", () => {
    const output = new YamlWorkflowDefinitionSerializer().serialize(workflowFixture());
    expect(output).not.toContain("{");
    expect(output).toContain("id: sample-workflow");
  });

  it("throws SerializationException when js-yaml cannot represent a value (e.g. a function)", () => {
    const unrepresentable = { ...workflowFixture(), metadata: { fn: () => "unrepresentable" } };
    expect(() => new YamlWorkflowDefinitionSerializer().serialize(unrepresentable)).toThrow(
      "Failed to serialize Workflow Definition to YAML",
    );
  });
});
