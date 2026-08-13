import { describe, expect, it } from "vitest";

import { VideoPrompt } from "../../../src/domain/value-objects/VideoPrompt.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("VideoPrompt", () => {
  it("creates a valid VideoPrompt from a non-empty string", () => {
    const prompt = unwrap(VideoPrompt.create("White Mitsubishi Xpander SUV, cinematic"));
    expect(prompt.toString()).toBe("White Mitsubishi Xpander SUV, cinematic");
  });

  it("rejects an empty string", () => {
    const error = unwrapErr(VideoPrompt.create(""));
    expect(error.message).toMatch(/non-empty string/);
  });

  it("rejects a whitespace-only string", () => {
    const error = unwrapErr(VideoPrompt.create("   "));
    expect(error.message).toMatch(/non-empty string/);
  });

  it("rejects a string over the max length", () => {
    const error = unwrapErr(VideoPrompt.create("a".repeat(5001)));
    expect(error.message).toMatch(/must not exceed/);
  });

  it("accepts a string exactly at the max length", () => {
    const prompt = unwrap(VideoPrompt.create("a".repeat(5000)));
    expect(prompt.toString()).toHaveLength(5000);
  });

  it("two VideoPrompts with the same value are equal", () => {
    const a = unwrap(VideoPrompt.create("same"));
    const b = unwrap(VideoPrompt.create("same"));
    expect(a.equals(b)).toBe(true);
  });
});
