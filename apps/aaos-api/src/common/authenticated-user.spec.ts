import type { ExecutionContext } from "@nestjs/common";
import { expect, it } from "vitest";

import { authenticatedUserIdFactory } from "./tenant-context.js";

const context = (request: unknown) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as ExecutionContext;
it("takes the approval actor from trusted context and ignores spoofed body/header identity", () => {
  expect(
    authenticatedUserIdFactory(
      undefined,
      context({
        tenantContext: { userId: "real-user" },
        body: { decidedBy: "spoofed" },
        headers: { "x-user-id": "spoofed" },
      }),
    ),
  ).toBe("real-user");
});
it("fails closed without trusted actor even when a client supplies an identity", () => {
  expect(() =>
    authenticatedUserIdFactory(
      undefined,
      context({ body: { decidedBy: "spoofed" }, headers: { "x-user-id": "spoofed" } }),
    ),
  ).toThrow("Trusted actor context required");
});
