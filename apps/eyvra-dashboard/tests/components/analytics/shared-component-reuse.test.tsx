import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Real assertion of this dispatch's own explicit checklist requirement: "drawer PROMPT 11 dan
 * modal heatmap PROMPT 12 reuse komponen yang sama (jangan duplikat kode metric-card +
 * copy-variation)". Rather than only checking runtime DOM output (which could coincidentally match
 * even with two separately-authored components), this reads both real source files and asserts
 * they import the SAME shared modules — proving genuine code reuse, not a visual coincidence.
 */
const ROOT = join(__dirname, "..", "..", "..", "src", "components");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf-8");
}

describe("shared MetricCard / CopyVariantList reuse (Prompt 11 <-> Prompt 12)", () => {
  it("CampaignDetailDrawer (Prompt 11) imports the shared analytics MetricCard, not a local copy", () => {
    const source = readSource("campaigns/CampaignDetailDrawer.tsx");
    expect(source).toMatch(/from ["']@\/components\/analytics\/MetricCard["']/);
  });

  it("AssetDetailModal (Prompt 12's read-only detail view) imports the SAME shared analytics MetricCard", () => {
    const source = readSource("analytics/AssetDetailModal.tsx");
    expect(source).toMatch(/from ["']\.\/MetricCard["']/);
  });

  it("CampaignDetailDrawer imports the shared analytics CopyVariantList, not a local copy", () => {
    const source = readSource("campaigns/CampaignDetailDrawer.tsx");
    expect(source).toMatch(/from ["']@\/components\/analytics\/CopyVariantList["']/);
  });

  it("AssetDetailModal imports the SAME shared analytics CopyVariantList", () => {
    const source = readSource("analytics/AssetDetailModal.tsx");
    expect(source).toMatch(/from ["']\.\/CopyVariantList["']/);
  });

  it("neither surface defines its own competing MetricCard/CopyVariantList component", () => {
    const drawer = readSource("campaigns/CampaignDetailDrawer.tsx");
    const modal = readSource("analytics/AssetDetailModal.tsx");
    expect(drawer).not.toMatch(/function MetricCard|function CopyVariantList/);
    expect(modal).not.toMatch(/function MetricCard|function CopyVariantList/);
  });
});
