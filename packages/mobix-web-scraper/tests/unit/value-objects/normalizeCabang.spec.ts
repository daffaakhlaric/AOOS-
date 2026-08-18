import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import { normalizeCabang } from "../../../src/domain/value-objects/normalizeCabang.js";

describe("normalizeCabang", () => {
  it.each([
    ["BINTARO", Branch.BINTARO],
    ["CINERE", Branch.CINERE],
    ["BANDUNG", Branch.BANDUNG],
  ])("maps the real cabang %s onto its Branch member without warning", (raw, expected) => {
    const onFallback = vi.fn();

    expect(normalizeCabang(raw, onFallback)).toBe(expected);
    expect(onFallback).not.toHaveBeenCalled();
  });

  it.each([["bintaro"], ["Bintaro"], ["  BINTARO  "]])(
    "matches case-insensitively and trims whitespace (%s)",
    (raw) => {
      const onFallback = vi.fn();

      expect(normalizeCabang(raw, onFallback)).toBe(Branch.BINTARO);
      expect(onFallback).not.toHaveBeenCalled();
    },
  );

  it('falls back to UMUM and warns for the real unmodelled branch "PONDOK BAMBU"', () => {
    const onFallback = vi.fn();

    expect(normalizeCabang("PONDOK BAMBU", onFallback)).toBe(Branch.UMUM);
    expect(onFallback).toHaveBeenCalledTimes(1);
    // The RAW value must reach the warning verbatim, so the log names the real branch.
    expect(onFallback).toHaveBeenCalledWith("PONDOK BAMBU");
  });

  it('falls back to UMUM and warns for the real internal code "hq3"', () => {
    const onFallback = vi.fn();

    expect(normalizeCabang("hq3", onFallback)).toBe(Branch.UMUM);
    expect(onFallback).toHaveBeenCalledWith("hq3");
  });

  it("falls back to UMUM and warns for an entirely unknown value", () => {
    const onFallback = vi.fn();

    expect(normalizeCabang("SOMEWHERE NEW", onFallback)).toBe(Branch.UMUM);
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it("tolerates an empty string and a non-string, still falling back rather than throwing", () => {
    const onFallback = vi.fn();

    expect(normalizeCabang("", onFallback)).toBe(Branch.UMUM);
    expect(normalizeCabang(undefined as unknown as string, onFallback)).toBe(Branch.UMUM);
    expect(onFallback).toHaveBeenCalledTimes(2);
  });

  it("never throws when no onFallback listener is supplied", () => {
    expect(normalizeCabang("PONDOK BAMBU")).toBe(Branch.UMUM);
  });
});
