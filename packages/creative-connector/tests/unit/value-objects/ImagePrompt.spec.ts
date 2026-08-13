import { describe, expect, it } from "vitest";

import { ImagePrompt } from "../../../src/domain/value-objects/ImagePrompt.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("ImagePrompt", () => {
  it("creates a valid ImagePrompt from a non-empty string", () => {
    const prompt = unwrap(ImagePrompt.create("Professional car photography"));
    expect(prompt.toString()).toBe("Professional car photography");
  });

  it("rejects an empty string", () => {
    const error = unwrapErr(ImagePrompt.create(""));
    expect(error.message).toMatch(/non-empty string/);
  });

  it("rejects a string over the max length", () => {
    const error = unwrapErr(ImagePrompt.create("a".repeat(5001)));
    expect(error.message).toMatch(/must not exceed/);
  });

  it("accepts a string exactly at the max length", () => {
    const prompt = unwrap(ImagePrompt.create("a".repeat(5000)));
    expect(prompt.toString()).toHaveLength(5000);
  });

  it("two ImagePrompts with different values are not equal", () => {
    const a = unwrap(ImagePrompt.create("a"));
    const b = unwrap(ImagePrompt.create("b"));
    expect(a.equals(b)).toBe(false);
  });
});
