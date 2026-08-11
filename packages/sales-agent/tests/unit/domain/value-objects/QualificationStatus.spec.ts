import { describe, expect, it } from "vitest";

import {
  ALL_QUALIFICATION_STATUSES,
  QualificationStatus,
} from "../../../../src/domain/value-objects/QualificationStatus.js";

describe("QualificationStatus", () => {
  it("has exactly 6 criteria", () => {
    expect(ALL_QUALIFICATION_STATUSES).toHaveLength(6);
  });

  it("includes BUDGET, UNIT, AREA, PAYMENT, TIMELINE, NAME", () => {
    expect(ALL_QUALIFICATION_STATUSES).toEqual([
      QualificationStatus.BUDGET,
      QualificationStatus.UNIT,
      QualificationStatus.AREA,
      QualificationStatus.PAYMENT,
      QualificationStatus.TIMELINE,
      QualificationStatus.NAME,
    ]);
  });
});
