import { describe, expect, it } from "vitest";

import {
  ABRUPT_CLOSING_PATTERN,
  BULLET_OR_NUMBERED_LIST_PATTERN,
  CASUAL_WORDS_PATTERN,
  CLOSING_INTENT_PATTERN,
  EMOJI_PATTERN,
  FORMAL_PHRASE_PATTERN,
  MOBIX_USP_PATTERN,
  PUSHY_PATTERN,
  ROBOT_GREETING_PATTERN,
  SALES_TEAM_MENTION_PATTERN,
} from "../../../src/scorers/TextPatterns.js";

describe("TextPatterns", () => {
  it("EMOJI_PATTERN matches 😊🙏✅", () => {
    expect(EMOJI_PATTERN.test("oke 😊")).toBe(true);
    expect(EMOJI_PATTERN.test("oke 🙏")).toBe(true);
    expect(EMOJI_PATTERN.test("oke ✅")).toBe(true);
    expect(EMOJI_PATTERN.test("oke tanpa emoji")).toBe(false);
  });

  it("CASUAL_WORDS_PATTERN matches kak/nih/deh/dong/sih", () => {
    expect(CASUAL_WORDS_PATTERN.test("kak")).toBe(true);
    expect(CASUAL_WORDS_PATTERN.test("formal saja")).toBe(false);
  });

  it("FORMAL_PHRASE_PATTERN matches the two stiff openers", () => {
    expect(FORMAL_PHRASE_PATTERN.test("Dengan hormat")).toBe(true);
    expect(FORMAL_PHRASE_PATTERN.test("Perkenalkan")).toBe(true);
    expect(FORMAL_PHRASE_PATTERN.test("halo kak")).toBe(false);
  });

  it("ROBOT_GREETING_PATTERN matches only the exact literal opener, anchored", () => {
    expect(
      ROBOT_GREETING_PATTERN.test("Halo, saya Jessy dari Mobix By DSS Motor, apa kabar?"),
    ).toBe(true);
    expect(ROBOT_GREETING_PATTERN.test("halo kak")).toBe(false);
  });

  it("BULLET_OR_NUMBERED_LIST_PATTERN matches bullets and numbered lines", () => {
    expect(BULLET_OR_NUMBERED_LIST_PATTERN.test("Info:\n- item satu")).toBe(true);
    expect(BULLET_OR_NUMBERED_LIST_PATTERN.test("Info:\n1. item satu")).toBe(true);
    expect(BULLET_OR_NUMBERED_LIST_PATTERN.test("kalimat biasa")).toBe(false);
  });

  it("MOBIX_USP_PATTERN matches Otospector/150 titik/garansi", () => {
    expect(MOBIX_USP_PATTERN.test("cek Otospector")).toBe(true);
    expect(MOBIX_USP_PATTERN.test("150 titik")).toBe(true);
    expect(MOBIX_USP_PATTERN.test("ada garansi")).toBe(true);
    expect(MOBIX_USP_PATTERN.test("tidak ada apa-apa")).toBe(false);
  });

  it("PUSHY_PATTERN matches the two pushy phrases", () => {
    expect(PUSHY_PATTERN.test("harus beli sekarang")).toBe(true);
    expect(PUSHY_PATTERN.test("stok terbatas banget")).toBe(true);
    expect(PUSHY_PATTERN.test("santai aja kak")).toBe(false);
  });

  it("CLOSING_INTENT_PATTERN matches test drive/survei/jadwal", () => {
    expect(CLOSING_INTENT_PATTERN.test("mau test drive?")).toBe(true);
    expect(CLOSING_INTENT_PATTERN.test("survei dulu yuk")).toBe(true);
    expect(CLOSING_INTENT_PATTERN.test("kita jadwal ya")).toBe(true);
    expect(CLOSING_INTENT_PATTERN.test("terima kasih")).toBe(false);
  });

  it("ABRUPT_CLOSING_PATTERN matches the formal example phrase", () => {
    expect(ABRUPT_CLOSING_PATTERN.test("Apakah Anda tertarik untuk survei?")).toBe(true);
    expect(ABRUPT_CLOSING_PATTERN.test("mau survei kak?")).toBe(false);
  });

  it("SALES_TEAM_MENTION_PATTERN matches 'tim kita'", () => {
    expect(SALES_TEAM_MENTION_PATTERN.test("sambungin ke tim kita ya")).toBe(true);
    expect(SALES_TEAM_MENTION_PATTERN.test("sambungin ke sales")).toBe(false);
  });
});
