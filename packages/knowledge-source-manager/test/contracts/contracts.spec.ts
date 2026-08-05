import { describe, expect, it } from "vitest";

import * as Contracts from "../../src/contracts/index.js";

describe("contracts barrel", () => {
  it("re-exports type-only symbols (no runtime members beyond the module object itself)", () => {
    // Every entry in contracts/index.ts is `export type`, so at runtime the module
    // namespace object has no own enumerable properties — this assertion documents
    // and locks in that "interfaces only" contract.
    expect(Object.keys(Contracts)).toEqual([]);
  });
});
