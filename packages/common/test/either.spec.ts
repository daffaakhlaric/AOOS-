import { describe, expect, it } from "vitest";

import { fold, isLeft, isRight, left, right } from "../src/either.js";

describe("Either", () => {
  it("left() and right() construct the two branches", () => {
    expect(isLeft(left("l"))).toBe(true);
    expect(isRight(right("r"))).toBe(true);
  });

  it("fold applies the matching handler", () => {
    expect(
      fold(
        left(1),
        (l) => `left:${l}`,
        (r) => `right:${r}`,
      ),
    ).toBe("left:1");
    expect(
      fold(
        right(2),
        (l) => `left:${l}`,
        (r) => `right:${r}`,
      ),
    ).toBe("right:2");
  });
});
