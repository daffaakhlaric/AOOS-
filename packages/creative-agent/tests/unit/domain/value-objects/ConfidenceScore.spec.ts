import { describe, expect, it } from "vitest";

import { ConfidenceScore } from "../../../../src/domain/value-objects/ConfidenceScore.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("ConfidenceScore", () => {
  it("create() accepts 0", () => {
    expect(unwrap(ConfidenceScore.create(0)).toNumber()).toBe(0);
  });

  it("create() accepts 100", () => {
    expect(unwrap(ConfidenceScore.create(100)).toNumber()).toBe(100);
  });

  it("create() rounds fractional scores", () => {
    expect(unwrap(ConfidenceScore.create(72.6)).toNumber()).toBe(73);
  });

  it("create() rejects below 0", () => {
    expect(unwrapErr(ConfidenceScore.create(-1)).message).toContain("0-100");
  });

  it("create() rejects above 100", () => {
    expect(unwrapErr(ConfidenceScore.create(101)).message).toContain("0-100");
  });

  it("create() rejects NaN", () => {
    expect(unwrapErr(ConfidenceScore.create(NaN)).message).toContain("0-100");
  });

  it("isAbove() compares correctly", () => {
    const score = unwrap(ConfidenceScore.create(80));
    expect(score.isAbove(70)).toBe(true);
    expect(score.isAbove(90)).toBe(false);
  });

  it("equals() compares by value", () => {
    const a = unwrap(ConfidenceScore.create(50));
    const b = unwrap(ConfidenceScore.create(50));
    expect(a.equals(b)).toBe(true);
  });

  describe("compute()", () => {
    it("full image coverage + no video requested -> 100", () => {
      const score = ConfidenceScore.compute({
        imageUrlCount: 3,
        requestedImageCount: 3,
        videoRequested: false,
        videoDelivered: false,
      });
      expect(score.toNumber()).toBe(100);
    });

    it("full image coverage + video requested and delivered -> 100", () => {
      const score = ConfidenceScore.compute({
        imageUrlCount: 3,
        requestedImageCount: 3,
        videoRequested: true,
        videoDelivered: true,
      });
      expect(score.toNumber()).toBe(100);
    });

    it("full image coverage + video requested but NOT delivered -> 60 (graceful fallback penalty)", () => {
      const score = ConfidenceScore.compute({
        imageUrlCount: 3,
        requestedImageCount: 3,
        videoRequested: true,
        videoDelivered: false,
      });
      expect(score.toNumber()).toBe(60);
    });

    it("partial image coverage (2 of 3) + no video requested -> 80", () => {
      const score = ConfidenceScore.compute({
        imageUrlCount: 2,
        requestedImageCount: 3,
        videoRequested: false,
        videoDelivered: false,
      });
      expect(score.toNumber()).toBe(80);
    });

    it("zero images -> 0 when video also not delivered but requested", () => {
      const score = ConfidenceScore.compute({
        imageUrlCount: 0,
        requestedImageCount: 3,
        videoRequested: true,
        videoDelivered: false,
      });
      expect(score.toNumber()).toBe(0);
    });

    it("requestedImageCount of 0 does not divide by zero", () => {
      const score = ConfidenceScore.compute({
        imageUrlCount: 0,
        requestedImageCount: 0,
        videoRequested: false,
        videoDelivered: false,
      });
      expect(score.toNumber()).toBe(40);
    });

    it("imageUrlCount exceeding requestedImageCount clamps coverage at 1", () => {
      const score = ConfidenceScore.compute({
        imageUrlCount: 5,
        requestedImageCount: 3,
        videoRequested: false,
        videoDelivered: false,
      });
      expect(score.toNumber()).toBe(100);
    });
  });
});
