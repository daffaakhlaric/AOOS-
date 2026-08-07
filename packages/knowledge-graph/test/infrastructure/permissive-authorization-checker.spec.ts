import { describe, expect, it } from "vitest";

import { PermissiveAuthorizationChecker } from "../../src/infrastructure/permissive-authorization-checker.js";
import { GraphOperationType } from "../../src/pipeline/graph-operation-type.js";

describe("PermissiveAuthorizationChecker", () => {
  it("always authorizes, regardless of the request", () => {
    const checker = new PermissiveAuthorizationChecker();
    expect(checker.isAuthorized({ operation: GraphOperationType.CreateNode, actor: "alice" })).toBe(
      true,
    );
    expect(checker.isAuthorized({ operation: GraphOperationType.DeleteGraph })).toBe(true);
  });
});
