import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { ConversationId } from "../../../../src/domain/value-objects/ConversationId.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("ConversationId", () => {
  it("fromParticipants() is deterministic for the same lead+branch", () => {
    const a = ConversationId.fromParticipants("+6281200000001", BranchId.CINERE);
    const b = ConversationId.fromParticipants("+6281200000001", BranchId.CINERE);
    expect(a.equals(b)).toBe(true);
    expect(a.toString()).toBe(b.toString());
  });

  it("fromParticipants() differs across branches for the same lead", () => {
    const a = ConversationId.fromParticipants("+6281200000001", BranchId.CINERE);
    const b = ConversationId.fromParticipants("+6281200000001", BranchId.BINTARO);
    expect(a.equals(b)).toBe(false);
  });

  it("create() accepts a non-empty string", () => {
    expect(unwrap(ConversationId.create("abc")).toString()).toBe("abc");
  });

  it("create() rejects an empty string", () => {
    expect(unwrapErr(ConversationId.create("")).message).toContain("non-empty");
  });
});
