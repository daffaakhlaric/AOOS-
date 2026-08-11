import { describe, expect, it } from "vitest";

import { ScoreReason, parseScoreReason } from "../../../src/domain/value-objects/ScoreReason.js";
import { unwrapErr } from "../../helpers/result.js";

describe("parseScoreReason", () => {
  it.each(Object.values(ScoreReason))("parses %s", (reason) => {
    const result = parseScoreReason(reason);
    expect(result.ok && result.value).toBe(reason);
  });

  it("is case-insensitive and trims", () => {
    const result = parseScoreReason(" budget ");
    expect(result.ok && result.value).toBe(ScoreReason.BUDGET);
  });

  it("rejects an unknown reason", () => {
    const error = unwrapErr(parseScoreReason("MOOD"));
    expect(error.message).toContain("MOOD");
  });

  it("rejects a non-string input", () => {
    const error = unwrapErr(parseScoreReason(undefined as unknown as string));
    expect(error.message).toContain("reason");
  });
});
