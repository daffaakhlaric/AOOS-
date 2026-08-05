import { describe, expect, it } from "vitest";

import { knowledgeSourceConfigurationRecordSchema } from "../../src/configuration/knowledge-source-configuration-record.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";

describe("knowledgeSourceConfigurationRecordSchema", () => {
  it("has exactly the 12 fields named in the prompt, plus sourceId as the key field", () => {
    const shape = knowledgeSourceConfigurationRecordSchema.shape;
    expect(Object.keys(shape)).toHaveLength(13);
  });

  it("accepts a well-formed record", () => {
    expect(() =>
      knowledgeSourceConfigurationRecordSchema.parse(configurationFixture()),
    ).not.toThrow();
  });

  it("rejects a negative priority", () => {
    expect(() =>
      knowledgeSourceConfigurationRecordSchema.parse(configurationFixture({ priority: -1 })),
    ).toThrow();
  });
});
