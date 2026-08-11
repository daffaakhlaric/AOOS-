import { describe, expect, it } from "vitest";

import { MessageId } from "../../../src/domain/value-objects/MessageId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("MessageId", () => {
  it("creates from a Meta wamid string", () => {
    const id = unwrap(MessageId.create("wamid.abc123"));
    expect(id.toString()).toBe("wamid.abc123");
  });

  it("rejects an empty string", () => {
    const error = unwrapErr(MessageId.create(""));
    expect(error.message).toContain("non-empty");
  });

  it("generate() produces a locally-prefixed placeholder id", () => {
    const id = MessageId.generate();
    expect(id.toString()).toMatch(/^local\./);
  });

  it("generate() produces distinct ids on each call", () => {
    const a = MessageId.generate();
    const b = MessageId.generate();
    expect(a.equals(b)).toBe(false);
  });

  it("equals compares by value", () => {
    const a = unwrap(MessageId.create("wamid.x"));
    const b = unwrap(MessageId.create("wamid.x"));
    expect(a.equals(b)).toBe(true);
  });
});
