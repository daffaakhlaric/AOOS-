import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { ConversationNotFoundError } from "../../../src/domain/errors/ConversationNotFoundError.js";
import { LeadNotFoundError } from "../../../src/domain/errors/LeadNotFoundError.js";
import { LeadStoreError } from "../../../src/domain/errors/LeadStoreError.js";
import { RealtimeError } from "../../../src/domain/errors/RealtimeError.js";
import { SupabaseError } from "../../../src/domain/errors/SupabaseError.js";

describe("LeadStoreError hierarchy", () => {
  it("LeadStoreError defaults to VALIDATION_ERROR", () => {
    const error = new LeadStoreError("bad input");
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.message).toBe("bad input");
    expect(error.name).toBe("LeadStoreError");
  });

  it("LeadStoreError accepts an explicit code", () => {
    const error = new LeadStoreError("conflict", { code: ErrorCode.CONFLICT });
    expect(error.code).toBe(ErrorCode.CONFLICT);
  });

  it("LeadNotFoundError uses NOT_FOUND", () => {
    const error = new LeadNotFoundError("lead missing");
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
    expect(error).toBeInstanceOf(LeadStoreError);
  });

  it("ConversationNotFoundError uses NOT_FOUND", () => {
    const error = new ConversationNotFoundError("conversation missing");
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
    expect(error).toBeInstanceOf(LeadStoreError);
  });

  it("SupabaseError uses UNAVAILABLE", () => {
    const error = new SupabaseError("db down");
    expect(error.code).toBe(ErrorCode.UNAVAILABLE);
    expect(error).toBeInstanceOf(LeadStoreError);
  });

  it("RealtimeError uses UNAVAILABLE", () => {
    const error = new RealtimeError("channel dropped");
    expect(error.code).toBe(ErrorCode.UNAVAILABLE);
    expect(error).toBeInstanceOf(LeadStoreError);
  });

  it("every error's toJSON is log-safe", () => {
    const error = new LeadNotFoundError("x", { context: { tenantId: "t1" } });
    const json = error.toJSON();
    expect(json).toMatchObject({
      name: "LeadNotFoundError",
      code: ErrorCode.NOT_FOUND,
      message: "x",
    });
  });
});
