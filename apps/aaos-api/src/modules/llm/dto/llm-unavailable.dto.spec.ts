import { describe, expect, it } from "vitest";

import { unavailable } from "./llm-unavailable.dto.js";

describe("unavailable", () => {
  it("builds a NO_API_KEY fallback with the spec's Section 7 copy", () => {
    expect(unavailable("NO_API_KEY")).toEqual({
      available: false,
      reason: "NO_API_KEY",
      message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
    });
  });

  it("builds a RATE_LIMITED fallback with the spec's Section 7 copy", () => {
    expect(unavailable("RATE_LIMITED")).toEqual({
      available: false,
      reason: "RATE_LIMITED",
      message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
    });
  });

  it("builds a PROVIDER_ERROR fallback with the spec's Section 7 copy", () => {
    expect(unavailable("PROVIDER_ERROR")).toEqual({
      available: false,
      reason: "PROVIDER_ERROR",
      message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
    });
  });

  it("builds an INVALID_RESPONSE fallback with the spec's Section 7 copy", () => {
    expect(unavailable("INVALID_RESPONSE")).toEqual({
      available: false,
      reason: "INVALID_RESPONSE",
      message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
    });
  });

  it("builds a NO_COPY_TEXT fallback with a real, honest message (AAOS Samantha Professional Optimizer, Part C)", () => {
    expect(unavailable("NO_COPY_TEXT")).toEqual({
      available: false,
      reason: "NO_COPY_TEXT",
      message: "Teks iklan tidak tersedia dari Meta untuk tipe creative ini, tidak bisa dianalisis",
    });
  });
});
