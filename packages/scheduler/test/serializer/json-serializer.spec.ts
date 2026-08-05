import { describe, expect, it } from "vitest";

import { SchedulerException } from "../../src/errors/scheduler-exception.js";
import { JsonSerializer } from "../../src/serializer/json-serializer.js";

describe("JsonSerializer", () => {
  it("round-trips a plain object", () => {
    const serializer = new JsonSerializer();
    const value = { a: 1, b: "two", c: [1, 2, 3] };
    expect(serializer.deserialize(serializer.serialize(value))).toEqual(value);
  });

  it("deserializes from a Uint8Array", () => {
    const serializer = new JsonSerializer();
    const bytes = new TextEncoder().encode(JSON.stringify({ a: 1 }));
    expect(serializer.deserialize(bytes)).toEqual({ a: 1 });
  });

  it("throws SchedulerException on malformed JSON", () => {
    const serializer = new JsonSerializer();
    expect(() => serializer.deserialize("{not json")).toThrow(SchedulerException);
  });

  it("reports its format as json", () => {
    expect(new JsonSerializer().format).toBe("json");
  });
});
