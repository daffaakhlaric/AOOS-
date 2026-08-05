import { describe, expect, it } from "vitest";
import { z } from "zod";

import { SchemaValidator } from "../../src/validators/schema-validator.js";

const schema = z.object({ id: z.string().min(1), count: z.number().positive() });

describe("Schema Validation Test — SchemaValidator", () => {
  it("passes a conformant manifest", () => {
    const validator = new SchemaValidator(schema);
    const result = validator.validate({ id: "x", count: 1 });
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("collects one issue per Zod error, with a readable path", () => {
    const validator = new SchemaValidator(schema);
    const result = validator.validate({ id: "", count: -1 });
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.path)).toEqual(["id", "count"]);
  });

  it("labels a root-level error as (root)", () => {
    const validator = new SchemaValidator(z.string());
    const result = validator.validate(42);
    expect(result.issues[0]?.path).toBe("(root)");
  });
});
