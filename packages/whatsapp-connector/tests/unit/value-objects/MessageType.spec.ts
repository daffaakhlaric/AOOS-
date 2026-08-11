import { describe, expect, it } from "vitest";

import { MessageType } from "../../../src/domain/value-objects/MessageType.js";

describe("MessageType", () => {
  it("has exactly the 5 spec-listed members", () => {
    expect(Object.values(MessageType).sort()).toEqual(
      ["DOCUMENT", "IMAGE", "INTERACTIVE", "TEMPLATE", "TEXT"].sort(),
    );
  });

  it("each member's wire value equals its own key (stable across the wire, not a display label)", () => {
    for (const key of Object.keys(MessageType) as Array<keyof typeof MessageType>) {
      expect(MessageType[key]).toBe(key);
    }
  });

  it("TEXT is exactly the string 'TEXT' (relied on by IncomingMessageMapper/mappers)", () => {
    expect(MessageType.TEXT).toBe("TEXT");
  });
});
