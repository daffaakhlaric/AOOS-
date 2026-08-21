import { AdAngle } from "@aos/meta-ads-agent";
import { describe, expect, it } from "vitest";

import { angleSetKey, selectUnusedAngleSet, variantLabelForIndex } from "./angle-pairs.js";

describe("angleSetKey", () => {
  it("is order-independent", () => {
    expect(angleSetKey([AdAngle.DP_RINGAN, AdAngle.GUDANGNYA])).toBe(
      angleSetKey([AdAngle.GUDANGNYA, AdAngle.DP_RINGAN]),
    );
  });

  it("differs for different angle sets", () => {
    expect(angleSetKey([AdAngle.DP_RINGAN, AdAngle.GUDANGNYA])).not.toBe(
      angleSetKey([AdAngle.DP_RINGAN, AdAngle.TESTIMONIAL]),
    );
  });
});

describe("selectUnusedAngleSet", () => {
  it("returns the first pair when nothing has been used", () => {
    const result = selectUnusedAngleSet(new Set(), 2);
    expect(result).toEqual([AdAngle.DP_RINGAN, AdAngle.GUDANGNYA]);
  });

  it("returns the first triple when count is 3", () => {
    const result = selectUnusedAngleSet(new Set(), 3);
    expect(result).toHaveLength(3);
  });

  it("skips a used pair and returns the next unused one", () => {
    const used = new Set([angleSetKey([AdAngle.DP_RINGAN, AdAngle.GUDANGNYA])]);
    const result = selectUnusedAngleSet(used, 2);
    expect(angleSetKey(result)).not.toBe(angleSetKey([AdAngle.DP_RINGAN, AdAngle.GUDANGNYA]));
  });

  it("cycles back to the first pair once every candidate has been used", () => {
    const allPairs: readonly (readonly AdAngle[])[] = [
      [AdAngle.DP_RINGAN, AdAngle.GUDANGNYA],
      [AdAngle.DP_RINGAN, AdAngle.TESTIMONIAL],
      [AdAngle.KREDIT_SYARIAH, AdAngle.DISCOVERY],
      [AdAngle.QNA, AdAngle.DP_RINGAN],
    ];
    const used = new Set(allPairs.map((pair) => angleSetKey(pair)));
    const result = selectUnusedAngleSet(used, 2);
    expect(angleSetKey(result)).toBe(angleSetKey([AdAngle.DP_RINGAN, AdAngle.GUDANGNYA]));
  });
});

describe("variantLabelForIndex", () => {
  it("maps 0/1/2 to A/B/C", () => {
    expect(variantLabelForIndex(0)).toBe("A");
    expect(variantLabelForIndex(1)).toBe("B");
    expect(variantLabelForIndex(2)).toBe("C");
  });
});
