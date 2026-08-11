import { ValidationError } from "@aos/errors";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ZodValidationPipe } from "./zod-validation.pipe.js";

describe("ZodValidationPipe", () => {
  const schema = z.object({ name: z.string().min(1) });

  it("returns the parsed value when validation succeeds", () => {
    const pipe = new ZodValidationPipe(schema);
    expect(pipe.transform({ name: "ok" })).toEqual({ name: "ok" });
  });

  it("throws a ValidationError with joined issue details on failure", () => {
    const pipe = new ZodValidationPipe(schema);
    expect(() => pipe.transform({ name: "" })).toThrow(ValidationError);
  });

  it("includes the failing field path in the thrown error message", () => {
    const pipe = new ZodValidationPipe(schema);
    try {
      pipe.transform({});
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).message).toContain("name");
    }
  });

  it("applies schema-level defaults/transforms to the returned value", () => {
    const schemaWithDefault = z.object({ datePreset: z.string().optional().default("last_30d") });
    const pipe = new ZodValidationPipe(schemaWithDefault);
    expect(pipe.transform({})).toEqual({ datePreset: "last_30d" });
  });

  it("labels a root-level (empty path) issue as (root) in the error message", () => {
    const rootSchema = z.string();
    const pipe = new ZodValidationPipe(rootSchema);
    try {
      pipe.transform(123);
      expect.unreachable();
    } catch (error) {
      expect((error as ValidationError).message).toContain("(root)");
    }
  });

  it("joins multiple issue paths with a semicolon", () => {
    const multiFieldSchema = z.object({ a: z.string().min(1), b: z.number() });
    const pipe = new ZodValidationPipe(multiFieldSchema);
    try {
      pipe.transform({ a: "", b: "not-a-number" });
      expect.unreachable();
    } catch (error) {
      const message = (error as ValidationError).message;
      expect(message).toContain("a:");
      expect(message).toContain("b:");
    }
  });
});
