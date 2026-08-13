import { describe, expect, it } from "vitest";

import { JobId } from "../../../../src/domain/value-objects/JobId.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("JobId", () => {
  it("create() accepts a non-empty string", () => {
    expect(unwrap(JobId.create("job-1")).toString()).toBe("job-1");
  });

  it("create() rejects an empty string", () => {
    expect(unwrapErr(JobId.create("")).message).toContain("JobId");
  });

  it("generate() produces a valid UUID", () => {
    expect(JobId.generate().toString()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("equals() compares by value", () => {
    const a = unwrap(JobId.create("x"));
    const b = unwrap(JobId.create("x"));
    const c = unwrap(JobId.create("y"));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
