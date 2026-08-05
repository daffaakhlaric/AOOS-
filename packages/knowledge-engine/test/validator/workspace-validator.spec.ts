import { describe, expect, it } from "vitest";

import { WorkspaceValidator } from "../../src/validator/workspace-validator.js";
import { assetFixture, scopeFixture } from "../helpers/asset-fixture.js";

describe("Validator Test — WorkspaceValidator", () => {
  it("passes when allowedWorkspaceIds is not configured", () => {
    expect(new WorkspaceValidator().validate({ asset: assetFixture() }).valid).toBe(true);
  });

  it("passes when the workspaceId is in the allow-list", () => {
    const asset = assetFixture({ scope: scopeFixture({ workspaceId: "workspace-1" }) });
    expect(
      new WorkspaceValidator().validate({ asset, allowedWorkspaceIds: ["workspace-1"] }).valid,
    ).toBe(true);
  });

  it("flags a workspaceId not in the allow-list", () => {
    const asset = assetFixture({ scope: scopeFixture({ workspaceId: "workspace-9" }) });
    expect(
      new WorkspaceValidator().validate({ asset, allowedWorkspaceIds: ["workspace-1"] }).valid,
    ).toBe(false);
  });
});
