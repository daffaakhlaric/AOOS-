import { describe, expect, it } from "vitest";

import {
  formatKm,
  formatPrice,
  MAX_MESSAGE_LENGTH,
  truncateToSentence,
} from "../../../src/responses/formatters.js";

describe("formatters", () => {
  it("formatPrice() formats with Indonesian thousand separators", () => {
    expect(formatPrice(195_000_000)).toBe("195.000.000");
  });

  it("formatPrice() rounds a fractional amount", () => {
    expect(formatPrice(1_000.6)).toBe("1.001");
  });

  it("formatKm() formats with Indonesian thousand separators", () => {
    expect(formatKm(45_000)).toBe("45.000");
  });

  it("formatKm() rounds a fractional value", () => {
    expect(formatKm(1_000.4)).toBe("1.000");
  });

  it("MAX_MESSAGE_LENGTH is 150 (spec: 'Tidak lebih dari 150 karakter per pesan')", () => {
    expect(MAX_MESSAGE_LENGTH).toBe(150);
  });

  it("truncateToSentence() leaves text at-or-under the limit untouched", () => {
    expect(truncateToSentence("Halo kak!", 150)).toBe("Halo kak!");
  });

  it("truncateToSentence() cuts at the nearest sentence boundary at-or-before maxLength", () => {
    const long = `${"a".repeat(140)}. ${"b".repeat(50)}.`;
    const result = truncateToSentence(long, 150);
    expect(result).toBe(`${"a".repeat(140)}.`);
    expect(result.length).toBeLessThanOrEqual(150);
  });

  it("truncateToSentence() falls back to a hard character cut when there's no early boundary", () => {
    const long = "a".repeat(300);
    const result = truncateToSentence(long, 150);
    expect(result).toBe("a".repeat(150));
  });

  it("truncateToSentence() defaults maxLength to MAX_MESSAGE_LENGTH", () => {
    const long = "a".repeat(300);
    expect(truncateToSentence(long)).toBe("a".repeat(150));
  });

  it("truncateToSentence() picks the LATEST boundary (! or ? after a .)", () => {
    const text = `${"a".repeat(50)}. ${"b".repeat(50)}! ${"c".repeat(60)}`;
    const result = truncateToSentence(text, 150);
    expect(result.endsWith("!")).toBe(true);
  });
});
