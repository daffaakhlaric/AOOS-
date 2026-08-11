import { describe, expect, it } from "vitest";

import {
  ALL_PERSONA_DIFFICULTIES,
  PersonaDifficulty,
} from "../../../../src/domain/value-objects/PersonaDifficulty.js";

describe("PersonaDifficulty", () => {
  it("has exactly 3 members: EASY, MEDIUM, HARD", () => {
    expect(Object.values(PersonaDifficulty)).toHaveLength(3);
    expect(ALL_PERSONA_DIFFICULTIES).toEqual([
      PersonaDifficulty.EASY,
      PersonaDifficulty.MEDIUM,
      PersonaDifficulty.HARD,
    ]);
  });
});
