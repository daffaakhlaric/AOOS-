import { describe, expect, it } from "vitest";

import { OrSpecification } from "../../../src/classification/specifications/or-specification.js";
import type { ISpecification } from "../../../src/contracts/i-specification.js";

function make(name: string, result: boolean): ISpecification<unknown> {
  return { name, isSatisfiedBy: () => result };
}

describe("OrSpecification", () => {
  it("is satisfied when at least one operand is satisfied", () => {
    expect(new OrSpecification(make("a", true), make("b", false)).isSatisfiedBy({})).toBe(true);
    expect(new OrSpecification(make("a", false), make("b", true)).isSatisfiedBy({})).toBe(true);
    expect(new OrSpecification(make("a", false), make("b", false)).isSatisfiedBy({})).toBe(false);
  });

  it("builds a descriptive combined name", () => {
    expect(new OrSpecification(make("a", true), make("b", true)).name).toBe("(a OR b)");
  });
});
