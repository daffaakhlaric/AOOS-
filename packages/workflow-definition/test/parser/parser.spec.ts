import { describe, expect, it } from "vitest";

import { ParseException } from "../../src/errors/parse-exception.js";
import { JsonWorkflowDefinitionParser } from "../../src/parser/json-parser.js";
import { YamlWorkflowDefinitionParser } from "../../src/parser/yaml-parser.js";
import { JsonWorkflowDefinitionSerializer } from "../../src/serializer/json-serializer.js";
import { YamlWorkflowDefinitionSerializer } from "../../src/serializer/yaml-serializer.js";
import { workflowFixture } from "../helpers/workflow-fixture.js";

describe("Parser Test — JsonWorkflowDefinitionParser", () => {
  it("parses valid JSON into a WorkflowDefinition", () => {
    const parser = new JsonWorkflowDefinitionParser();
    const json = new JsonWorkflowDefinitionSerializer().serialize(workflowFixture());
    const parsed = parser.parse(json);
    expect(parsed.id).toBe("sample-workflow");
    expect(parsed.nodes).toHaveLength(3);
  });

  it("reports its format as json", () => {
    expect(new JsonWorkflowDefinitionParser().format).toBe("json");
  });

  it("throws ParseException on malformed JSON syntax", () => {
    expect(() => new JsonWorkflowDefinitionParser().parse("{not json")).toThrow(ParseException);
  });

  it("throws ParseException when the parsed object fails schema validation", () => {
    expect(() => new JsonWorkflowDefinitionParser().parse(JSON.stringify({ id: "x" }))).toThrow(
      ParseException,
    );
  });

  it("reports a '(root)' path when the top-level value itself is not an object", () => {
    expect(() => new JsonWorkflowDefinitionParser().parse("42")).toThrow(/\(root\)/);
  });
});

describe("Parser Test — YamlWorkflowDefinitionParser", () => {
  it("parses valid YAML into a WorkflowDefinition — Human readable round trip", () => {
    const parser = new YamlWorkflowDefinitionParser();
    const yamlText = new YamlWorkflowDefinitionSerializer().serialize(workflowFixture());
    const parsed = parser.parse(yamlText);
    expect(parsed.id).toBe("sample-workflow");
    expect(parsed.transitions).toHaveLength(2);
  });

  it("reports its format as yaml", () => {
    expect(new YamlWorkflowDefinitionParser().format).toBe("yaml");
  });

  it("throws ParseException on malformed YAML syntax", () => {
    expect(() => new YamlWorkflowDefinitionParser().parse("nodes: [unterminated")).toThrow(
      ParseException,
    );
  });

  it("throws ParseException when the parsed object fails schema validation", () => {
    expect(() => new YamlWorkflowDefinitionParser().parse("id: x")).toThrow(ParseException);
  });

  it("reports a '(root)' path when the top-level value itself is not an object", () => {
    expect(() => new YamlWorkflowDefinitionParser().parse("42")).toThrow(/\(root\)/);
  });
});
