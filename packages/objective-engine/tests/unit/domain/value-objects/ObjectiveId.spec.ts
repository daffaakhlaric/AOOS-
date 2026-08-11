import { describe, expect, it } from "vitest";

import { ObjectiveId } from "../../../../src/domain/value-objects/ObjectiveId.js";
import { unwrap } from "../../../helpers/result.js";

describe("ObjectiveId", () => {
  it("creates from a valid UUID", () => {
    const id = unwrap(ObjectiveId.create("00000000-0000-4000-8000-000000000001"));
    expect(id.toString()).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("rejects a non-UUID string", () => {
    expect(ObjectiveId.create("not-a-uuid").ok).toBe(false);
  });

  it("rejects a non-string", () => {
    expect(ObjectiveId.create(123 as unknown as string).ok).toBe(false);
  });

  it("generate() produces a valid UUID", () => {
    const id = ObjectiveId.generate();
    expect(unwrap(ObjectiveId.create(id.toString())).toString()).toBe(id.toString());
  });

  it("generate() produces distinct ids", () => {
    expect(ObjectiveId.generate().toString()).not.toBe(ObjectiveId.generate().toString());
  });

  it("equals compares by value", () => {
    const a = unwrap(ObjectiveId.create("00000000-0000-4000-8000-000000000001"));
    const b = unwrap(ObjectiveId.create("00000000-0000-4000-8000-000000000001"));
    const c = unwrap(ObjectiveId.create("00000000-0000-4000-8000-000000000002"));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
