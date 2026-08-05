import { describe, expect, it } from "vitest";

import { KnowledgeValidator } from "../../src/validator/knowledge-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";

describe("Validator Test — KnowledgeValidator", () => {
  it("reports valid:true for a well-formed fixture Asset with no extra config", () => {
    const result = new KnowledgeValidator().validate({ asset: assetFixture() });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("aggregates issues across multiple stages without short-circuiting", () => {
    const asset = assetFixture();
    const mutated = {
      ...asset,
      namespace: "not-a-namespace",
      version: { ...asset.version, label: "9.9.9" },
    };
    const result = new KnowledgeValidator().validate({ asset: mutated });
    expect(result.valid).toBe(false);
    const paths = result.issues.map((issue) => issue.path);
    expect(paths).toContain("namespace");
    expect(paths).toContain("version.label");
  });

  it("runs an injected extra validator stage alongside the built-in 14", () => {
    const extraStage = {
      name: "custom",
      validate: () => ({ valid: false, issues: [{ path: "custom", message: "always fails" }] }),
    };
    const result = new KnowledgeValidator([extraStage]).validate({ asset: assetFixture() });
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ path: "custom", message: "always fails" });
  });
});
