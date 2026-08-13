import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { CreativeAgentError } from "../../../../src/domain/errors/CreativeAgentError.js";
import { NoSourcePhotosError } from "../../../../src/domain/errors/NoSourcePhotosError.js";

describe("NoSourcePhotosError", () => {
  it("extends CreativeAgentError", () => {
    expect(new NoSourcePhotosError("query failed")).toBeInstanceOf(CreativeAgentError);
  });

  it("always uses ErrorCode.UNAVAILABLE", () => {
    expect(new NoSourcePhotosError("query failed").code).toBe(ErrorCode.UNAVAILABLE);
  });

  it("name is 'NoSourcePhotosError'", () => {
    expect(new NoSourcePhotosError("query failed").name).toBe("NoSourcePhotosError");
  });

  it("is reserved for repository query failures, not zero-photos-found (documented via message content in this suite's other specs)", () => {
    const error = new NoSourcePhotosError(
      'Kai: failed to query source photos for unit "Xpander Cross 2019": db timeout',
    );
    expect(error.message).toContain("failed to query");
  });
});
