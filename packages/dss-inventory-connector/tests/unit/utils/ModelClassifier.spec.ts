import { describe, expect, it } from "vitest";

import { UnitTransmission } from "../../../src/domain/value-objects/UnitTransmission.js";
import { classifyModel } from "../../../src/utils/ModelClassifier.js";

describe("classifyModel", () => {
  it('parses "Xpander Cross AT" (spec example 1)', () => {
    expect(classifyModel("Xpander Cross AT")).toEqual({
      model: "Xpander Cross",
      transmission: UnitTransmission.AT,
    });
  });

  it('parses "Avanza Veloz MT 2019" (spec example 2)', () => {
    expect(classifyModel("Avanza Veloz MT 2019")).toEqual({
      model: "Avanza Veloz",
      transmission: UnitTransmission.MT,
      year: 2019,
    });
  });

  it("handles a string with no transmission or year", () => {
    expect(classifyModel("Rush G")).toEqual({ model: "Rush G" });
  });

  it("handles a year with no transmission", () => {
    expect(classifyModel("Stargazer Essential 2023")).toEqual({
      model: "Stargazer Essential",
      year: 2023,
    });
  });

  it("is case-insensitive for the transmission token", () => {
    expect(classifyModel("Brio Satya mt")).toEqual({
      model: "Brio Satya",
      transmission: UnitTransmission.MT,
    });
  });

  it("does not treat an embedded 'AT'/'MT' substring (not whole-word) as transmission", () => {
    // "Attitude" contains "AT" but not as a whole word.
    expect(classifyModel("Attitude Series")).toEqual({ model: "Attitude Series" });
  });

  it("collapses extra internal whitespace left after removing tokens", () => {
    expect(classifyModel("Xpander   Cross   AT   2019")).toEqual({
      model: "Xpander Cross",
      transmission: UnitTransmission.AT,
      year: 2019,
    });
  });

  it("handles an empty string", () => {
    expect(classifyModel("")).toEqual({ model: "" });
  });

  it("does not treat a non-4-digit number as a year", () => {
    expect(classifyModel("Model 123")).toEqual({ model: "Model 123" });
  });
});
