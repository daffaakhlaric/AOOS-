import { describe, expect, it } from "vitest";

import { EventBusException } from "../../src/errors/event-bus-exception.js";
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

  it("throws EventBusException on malformed JSON", () => {
    const serializer = new JsonSerializer();
    expect(() => serializer.deserialize("{not json")).toThrow(EventBusException);
  });

  it("reports its format as json", () => {
    expect(new JsonSerializer().format).toBe("json");
  });
});
