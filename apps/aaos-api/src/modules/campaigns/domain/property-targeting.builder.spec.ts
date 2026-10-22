import { ok } from "@aos/common";
import type { SearchAdLocations } from "@aos/meta-ads-connector";
import { expect, it } from "vitest";

import type { ResolvedLocation } from "../../location-resolver/location-resolver.service.js";

import { resolvePropertyTargeting } from "./property-targeting.builder.js";

const plan: ResolvedLocation = {
  cities: ["Jakarta", "Bekasi"],
  radiusKm: 30,
  ageMin: 18,
  ageMax: 65,
  source: "LLM",
  reasoning: "Approved plan",
};
const search: Pick<SearchAdLocations, "execute"> = {
  execute: async ({ query }) =>
    ok([{ key: query, name: query, type: "city", countryCode: "ID", query }]),
};
it("preserves all approved cities and exact radius", async () => {
  const result = await resolvePropertyTargeting(search, plan, "test");
  expect(result.targeting.geoLocations?.cities.map((c) => c.key)).toEqual(plan.cities);
  expect(result.targeting.geoLocations?.cities.every((c) => c.radius === 30)).toBe(true);
});
it("rejects a missing city and unsupported radius instead of silently changing the plan", async () => {
  await expect(
    resolvePropertyTargeting(
      {
        execute: async ({ query }) =>
          query === "Bekasi"
            ? ok([])
            : search.execute({ query, locationType: "city", accessToken: "test" }),
      },
      plan,
      "test",
    ),
  ).rejects.toThrow("PRECHECK_FAILED");
  await expect(resolvePropertyTargeting(search, { ...plan, radiusKm: 5 }, "test")).rejects.toThrow(
    "PRECHECK_FAILED",
  );
});
