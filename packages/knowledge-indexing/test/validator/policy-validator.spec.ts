import { describe, expect, it } from "vitest";

import { KnowledgeIndexRegistry } from "../../src/registry/knowledge-index-registry.js";
import { PolicyValidator } from "../../src/validator/policy-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";

describe("Validator Test — PolicyValidator", () => {
  it("passes for a valid Classification", () => {
    const asset = assetFixture();
    const result = new PolicyValidator().validate({
      asset,
      context: contextFixture(asset),
      registry: new KnowledgeIndexRegistry(),
      indexTypes: [],
    });
    expect(result.valid).toBe(true);
  });

  it("fails for an unknown Classification", () => {
    const asset = { ...assetFixture(), classification: "bogus" as never };
    const result = new PolicyValidator().validate({
      asset,
      context: contextFixture(asset),
      registry: new KnowledgeIndexRegistry(),
      indexTypes: [],
    });
    expect(result.valid).toBe(false);
  });
});
