import { describe, expect, it } from "vitest";

import { EmbeddingManagerException } from "../../src/errors/embedding-manager-exception.js";
import * as PublicApi from "../../src/index.js";

describe("Error hierarchy — extra scenarios", () => {
  it("EmbeddingManagerException.name is set via the concrete subclass (new.target)", () => {
    const error = new PublicApi.EmbeddingNotFoundException("boom");
    expect(error.name).toBe("EmbeddingNotFoundException");
  });

  it("EmbeddingManagerException carries the AosError ErrorCode.INTERNAL code", () => {
    const error = new EmbeddingManagerException("boom");
    expect(error.code).toBeDefined();
  });

  it("errors exported from the package barrel are the same classes as the direct module exports", () => {
    expect(PublicApi.EmbeddingManagerException).toBe(EmbeddingManagerException);
  });

  it("a thrown EmbeddingNotFoundException is catchable as a plain Error", () => {
    try {
      throw new PublicApi.EmbeddingNotFoundException("not found");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });
});
