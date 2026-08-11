import { describe, expect, it } from "vitest";

import { centsToRupiah, formatIDR, rupiahToCents } from "../../../src/utils/CurrencyUtils.js";

describe("CurrencyUtils", () => {
  describe("centsToRupiah", () => {
    it("divides by 100", () => {
      expect(centsToRupiah(1_000_000)).toBe(10_000);
    });

    it("truncates a fractional-cent remainder", () => {
      expect(centsToRupiah(1050)).toBe(10.5);
      expect(centsToRupiah(1001)).toBe(10.01);
      expect(centsToRupiah(999)).toBeCloseTo(9.99);
    });

    it("handles 0", () => {
      expect(centsToRupiah(0)).toBe(0);
    });

    it("handles negative cents (sign preserved via Math.trunc)", () => {
      expect(centsToRupiah(-500)).toBe(-5);
    });
  });

  describe("rupiahToCents", () => {
    it("multiplies by 100", () => {
      expect(rupiahToCents(10_000)).toBe(1_000_000);
    });

    it("rounds to the nearest integer cent", () => {
      expect(rupiahToCents(10.005)).toBe(1001);
      expect(rupiahToCents(10.004)).toBe(1000);
    });

    it("round-trips centsToRupiah for whole-Rupiah amounts", () => {
      const idr = 123_456;
      expect(centsToRupiah(rupiahToCents(idr))).toBe(idr);
    });

    it("handles 0", () => {
      expect(rupiahToCents(0)).toBe(0);
    });
  });

  describe("formatIDR", () => {
    it("formats with thousands separators and no decimals", () => {
      expect(formatIDR(12345)).toBe("Rp 12.345");
    });

    it("formats a value under 1000 without separators", () => {
      expect(formatIDR(500)).toBe("Rp 500");
    });

    it("formats 0", () => {
      expect(formatIDR(0)).toBe("Rp 0");
    });

    it("formats millions with two separators", () => {
      expect(formatIDR(1_234_567)).toBe("Rp 1.234.567");
    });

    it("formats a negative amount with a leading minus sign", () => {
      expect(formatIDR(-12345)).toBe("-Rp 12.345");
    });

    it("rounds a fractional amount", () => {
      expect(formatIDR(1000.6)).toBe("Rp 1.001");
    });

    it("formats exactly 1000 with one separator", () => {
      expect(formatIDR(1000)).toBe("Rp 1.000");
    });
  });
});
