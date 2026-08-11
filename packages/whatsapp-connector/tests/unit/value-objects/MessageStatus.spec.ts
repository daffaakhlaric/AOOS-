import { describe, expect, it } from "vitest";

import { MessageStatus } from "../../../src/domain/value-objects/MessageStatus.js";

describe("MessageStatus", () => {
  it("has exactly the 4 spec-listed members (built once, per the engineering report's resolution #2)", () => {
    expect(Object.values(MessageStatus).sort()).toEqual(
      ["DELIVERED", "FAILED", "READ", "SENT"].sort(),
    );
  });

  it("each member's wire value equals its own key (relied on by MessageStatusMapper's raw-string switch)", () => {
    for (const key of Object.keys(MessageStatus) as Array<keyof typeof MessageStatus>) {
      expect(MessageStatus[key]).toBe(key);
    }
  });

  it("members reflect the spec's lifecycle order sent -> delivered -> read, plus the terminal failed state", () => {
    expect([
      MessageStatus.SENT,
      MessageStatus.DELIVERED,
      MessageStatus.READ,
      MessageStatus.FAILED,
    ]).toEqual(["SENT", "DELIVERED", "READ", "FAILED"]);
  });
});
