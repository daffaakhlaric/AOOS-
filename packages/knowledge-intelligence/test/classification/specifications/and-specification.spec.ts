import { describe, expect, it } from "vitest";

import { AndSpecification } from "../../../src/classification/specifications/and-specification.js";
import type { ISpecification } from "../../../src/contracts/i-specification.js";

function make(name: string, result: boolean): ISpecification<unknown> {
  return { name, isSatisfiedBy: () => result };
}

describe("AndSpecification", () => {
  it("is satisfied only when both operands are satisfied", () => {
    expect(new AndSpecification(make("a", true), make("b", true)).isSatisfiedBy({})).toBe(true);
    expect(new AndSpecification(make("a", true), make("b", false)).isSatisfiedBy({})).toBe(false);
    expect(new AndSpecification(make("a", false), make("b", true)).isSatisfiedBy({})).toBe(false);
    expect(new AndSpecification(make("a", false), make("b", false)).isSatisfiedBy({})).toBe(false);
  });

  it("builds a descriptive combined name", () => {
    expect(new AndSpecification(make("a", true), make("b", true)).name).toBe("(a AND b)");
  });
});
