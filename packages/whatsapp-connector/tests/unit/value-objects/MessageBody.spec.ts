import { describe, expect, it } from "vitest";

import { InvalidMessageBodyError } from "../../../src/domain/errors/InvalidMessageBodyError.js";
import {
  MAX_MESSAGE_BODY_LENGTH,
  MessageBody,
} from "../../../src/domain/value-objects/MessageBody.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("MessageBody", () => {
  it("accepts a normal message", () => {
    const body = unwrap(MessageBody.create("Hai kak!"));
    expect(body.toString()).toBe("Hai kak!");
    expect(body.length).toBe(8);
  });

  it("accepts exactly 4096 characters (the WhatsApp Cloud API limit)", () => {
    const text = "a".repeat(MAX_MESSAGE_BODY_LENGTH);
    const body = unwrap(MessageBody.create(text));
    expect(body.length).toBe(MAX_MESSAGE_BODY_LENGTH);
  });

  it("rejects 4097 characters with InvalidMessageBodyError (spec pinned test)", () => {
    const text = "a".repeat(MAX_MESSAGE_BODY_LENGTH + 1);
    const error = unwrapErr(MessageBody.create(text));
    expect(error).toBeInstanceOf(InvalidMessageBodyError);
  });

  it("rejects an empty string", () => {
    const error = unwrapErr(MessageBody.create(""));
    expect(error).toBeInstanceOf(InvalidMessageBodyError);
  });

  it("equals compares by value", () => {
    const a = unwrap(MessageBody.create("hi"));
    const b = unwrap(MessageBody.create("hi"));
    const c = unwrap(MessageBody.create("bye"));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
