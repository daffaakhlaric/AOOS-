import { expect, it } from "vitest";
import { selectPropertyInterests } from "@/lib/meta-interests";
it("uses actual IDs, removes entertainment noise and prioritizes the property type", () => {
  const rows = [
    "Real Estate (band)",
    "House (TV series)",
    "House (property)",
    "Property investing (investing)",
  ].map((name, i) => ({ id: String(100 + i), name, searchTerm: "house", fetchedAt: "2026-09-03" }));
  expect(selectPropertyInterests(rows, "RUMAH").map((r) => r.id)).toEqual(["102", "103"]);
  expect(selectPropertyInterests(rows, "TANAH")[0]?.id).toBe("103");
  expect(selectPropertyInterests([], "RUMAH")).toEqual([]);
});
