import { describe, expect, it } from "vitest";

import { NotSpecification } from "../../../src/classification/specifications/not-specification.js";
import type { ISpecification } from "../../../src/contracts/i-specification.js";

function make(name: string, result: boolean): ISpecification<unknown> {
  return { name, isSatisfiedBy: () => result };
}

describe("NotSpecification", () => {
  it("inverts the wrapped specification's result", () => {
    expect(new NotSpecification(make("a", true)).isSatisfiedBy({})).toBe(false);
    expect(new NotSpecification(make("a", false)).isSatisfiedBy({})).toBe(true);
  });

  it("builds a descriptive combined name", () => {
    expect(new NotSpecification(make("a", true)).name).toBe("(NOT a)");
  });
});
