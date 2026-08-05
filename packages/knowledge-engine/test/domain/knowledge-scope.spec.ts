import { describe, expect, it } from "vitest";

import { scopeContains } from "../../src/domain/knowledge-scope.js";

describe("Domain Test — scopeContains", () => {
  it("returns true when the broader scope only sets tenantId and narrower matches", () => {
    expect(scopeContains({ tenantId: "t1" }, { tenantId: "t1", workspaceId: "w1" })).toBe(true);
  });

  it("returns false when tenantId differs", () => {
    expect(scopeContains({ tenantId: "t1" }, { tenantId: "t2" })).toBe(false);
  });

  it("returns false when a narrower workspaceId is set on broader but missing/different on narrower", () => {
    expect(scopeContains({ tenantId: "t1", workspaceId: "w1" }, { tenantId: "t1" })).toBe(false);
    expect(
      scopeContains({ tenantId: "t1", workspaceId: "w1" }, { tenantId: "t1", workspaceId: "w2" }),
    ).toBe(false);
  });

  it("returns true when every set field on broader matches narrower exactly", () => {
    expect(
      scopeContains(
        { tenantId: "t1", workspaceId: "w1", departmentId: "d1" },
        { tenantId: "t1", workspaceId: "w1", departmentId: "d1", teamId: "team1" },
      ),
    ).toBe(true);
  });
});
