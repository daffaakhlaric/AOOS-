import { describe, expect, it } from "vitest";

import { hasObjectionSignal } from "../../../src/scorers/ObjectionSignalPatterns.js";

describe("hasObjectionSignal", () => {
  it("detects the original 5 literal HESITATION phrases", () => {
    expect(hasObjectionSignal("aku pikir-pikir dulu deh")).toBe(true);
    expect(hasObjectionSignal("nanti aja ya")).toBe(true);
    expect(hasObjectionSignal("belum tau nih")).toBe(true);
    expect(hasObjectionSignal("cuma tanya aja kok")).toBe(true);
    expect(hasObjectionSignal("lihat-lihat dulu ya")).toBe(true);
  });

  it("detects quality-doubt phrases", () => {
    expect(hasObjectionSignal("beneran bagus gak sih unitnya")).toBe(true);
    expect(hasObjectionSignal("takut bermasalah kak")).toBe(true);
  });

  it("detects trust-concern phrases", () => {
    expect(hasObjectionSignal("aku ragu deh kak")).toBe(true);
    expect(hasObjectionSignal("kurang yakin nih")).toBe(true);
  });

  it("detects price-hesitation phrases", () => {
    expect(hasObjectionSignal("kok mahal banget")).toBe(true);
  });

  it("detects comparison-shopping phrases", () => {
    expect(hasObjectionSignal("di tempat lain lebih murah")).toBe(true);
  });

  it("detects cancel phrases", () => {
    expect(hasObjectionSignal("gak jadi deh kayaknya")).toBe(true);
  });

  it("detects COMPLAINT phrases (a friend's bad experience)", () => {
    expect(hasObjectionSignal("temen aku beli disini terus rusak, kecewa banget")).toBe(true);
  });

  it("returns false for plain interested/qualifying messages", () => {
    expect(hasObjectionSignal("mau xpander kak budget 250 juta")).toBe(false);
  });
});
