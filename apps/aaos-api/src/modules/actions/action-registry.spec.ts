import { expect, it } from "vitest";

import { routeRecommendation } from "./action-registry.js";
import { commandHash } from "./action.repository.js";

it("maps decisions without inventing executable mutations for holds or creative workflows", () => {
  expect(routeRecommendation("SCALE", "CAMPAIGN")).toEqual({
    kind: "META_ACTION",
    actionType: "UPDATE_BUDGET",
  });
  expect(routeRecommendation("SCALE", "AD").kind).toBe("UNSUPPORTED");
  expect(routeRecommendation("PAUSE", "ADSET")).toEqual({
    kind: "META_ACTION",
    actionType: "PAUSE_ADSET",
  });
  expect(routeRecommendation("HOLD", "CAMPAIGN")).toEqual({ kind: "NO_EXECUTION" });
  expect(routeRecommendation("REFRESH_CREATIVE", "CAMPAIGN").kind).toBe("WORKFLOW");
  expect(routeRecommendation("UNKNOWN", "CAMPAIGN").kind).toBe("UNSUPPORTED");
});
it("binds approvals to canonical command content", () => {
  expect(commandHash({ a: 1, b: { c: 2, d: 3 } })).toBe(commandHash({ b: { d: 3, c: 2 }, a: 1 }));
  expect(commandHash({ budget: 575000 })).not.toBe(commandHash({ budget: 600000 }));
});
