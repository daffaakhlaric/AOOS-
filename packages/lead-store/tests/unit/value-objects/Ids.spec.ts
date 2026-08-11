import type { Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";
import { describe, expect, it } from "vitest";

import { AssignmentId } from "../../../src/domain/value-objects/AssignmentId.js";
import { ClosingId } from "../../../src/domain/value-objects/ClosingId.js";
import { ConversationId } from "../../../src/domain/value-objects/ConversationId.js";
import { LeadId } from "../../../src/domain/value-objects/LeadId.js";
import { MessageId } from "../../../src/domain/value-objects/MessageId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

interface IdLike {
  toString(): string;
  equals(other: IdLike): boolean;
}

interface IdClassLike {
  create(raw: string): Result<IdLike, ValidationError>;
  generate(): IdLike;
}

/**
 * Shared behavior test for a `create`/`generate`/`toString`/`equals` id value object — written as
 * a plain function (rather than `describe.each` over the 5 classes) so each class's static
 * methods keep their own nominal return type; a shared generic here would collapse the 5 private
 * `#value` brands into `never` under strict type-checking. Each concrete `XxxId` class is
 * structurally assignable to `IdClassLike` (methods are bivariant in TS), so no cast is needed at
 * the 5 call sites below.
 */
function describeIdValueObject(name: string, IdClass: IdClassLike): void {
  describe(name, () => {
    it("create() accepts a non-empty string", () => {
      const id = unwrap(IdClass.create("abc-123"));
      expect(id.toString()).toBe("abc-123");
    });

    it("create() rejects an empty string", () => {
      const error = unwrapErr(IdClass.create(""));
      expect(error.message).toContain(name);
    });

    it("create() rejects a whitespace-only string", () => {
      const error = unwrapErr(IdClass.create("   "));
      expect(error.message).toContain(name);
    });

    it("generate() produces a non-empty unique id each call", () => {
      const a = IdClass.generate();
      const b = IdClass.generate();
      expect(a.toString().length).toBeGreaterThan(0);
      expect(a.equals(b)).toBe(false);
    });

    it("equals() compares by value", () => {
      const a = unwrap(IdClass.create("same"));
      const b = unwrap(IdClass.create("same"));
      const c = unwrap(IdClass.create("different"));
      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
    });
  });
}

describeIdValueObject("LeadId", LeadId);
describeIdValueObject("ConversationId", ConversationId);
describeIdValueObject("MessageId", MessageId);
describeIdValueObject("ClosingId", ClosingId);
describeIdValueObject("AssignmentId", AssignmentId);
