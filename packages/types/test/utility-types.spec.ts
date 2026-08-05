import { describe, expect, it } from "vitest";

import type {
  AtLeastOne,
  DeepPartial,
  DeepReadonly,
  NonEmptyArray,
  ValueOf,
} from "../src/index.js";

describe("utility-types", () => {
  it("DeepPartial allows nested optional assignment", () => {
    interface Shape {
      a: { b: { c: number } };
    }
    const partial: DeepPartial<Shape> = { a: { b: {} } };
    expect(partial.a?.b?.c).toBeUndefined();
  });

  it("DeepReadonly is a compile-time-only guarantee that does not affect runtime shape", () => {
    interface Shape {
      a: number;
    }
    const value: DeepReadonly<Shape> = { a: 1 };
    expect(value.a).toBe(1);
  });

  it("ValueOf extracts the union of an object's value types", () => {
    const map = { one: 1, two: 2 } as const;
    const value: ValueOf<typeof map> = 2;
    expect([1, 2]).toContain(value);
  });

  it("NonEmptyArray requires at least one element at the type level", () => {
    const arr: NonEmptyArray<number> = [1, 2, 3];
    expect(arr.length).toBeGreaterThan(0);
  });

  it("AtLeastOne allows a valid partial-with-one-required object", () => {
    interface Shape {
      a?: number;
      b?: number;
    }
    const value: AtLeastOne<Shape> = { a: 1 };
    expect(value.a).toBe(1);
  });
});
