import { describe, expect, it } from "vitest";

import { KnowledgeIndexRegistry } from "../../src/registry/knowledge-index-registry.js";
import { PermissionValidator } from "../../src/validator/permission-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";

describe("Validator Test — PermissionValidator", () => {
  it("passes when owner.userId is set", () => {
    const asset = assetFixture({ ownerId: "user-1" });
    const result = new PermissionValidator().validate({
      asset,
      context: contextFixture(asset),
      registry: new KnowledgeIndexRegistry(),
      indexTypes: [],
    });
    expect(result.valid).toBe(true);
  });

  it("fails when owner.userId is blank", () => {
    const asset = {
      ...assetFixture(),
      owner: { userId: "  ", assignedAt: new Date().toISOString() },
    };
    const result = new PermissionValidator().validate({
      asset,
      context: contextFixture(asset),
      registry: new KnowledgeIndexRegistry(),
      indexTypes: [],
    });
    expect(result.valid).toBe(false);
  });
});
