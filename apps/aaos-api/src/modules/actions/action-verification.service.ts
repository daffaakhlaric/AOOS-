export interface FrozenHierarchy {
  readonly campaignId: string;
  readonly adAccountId: string;
  readonly adSets: readonly { readonly id: string }[];
  readonly creatives: readonly { readonly id: string }[];
  readonly ads: readonly {
    readonly id: string;
    readonly adSetId: string;
    readonly creativeId: string;
  }[];
  readonly expectedAdSetCount: number;
  readonly expectedCreativeCount: number;
  readonly expectedAdCount: number;
  readonly configuredStatus: "PAUSED" | "ACTIVE";
}
export interface ProviderObject {
  readonly id: string;
  readonly accountId: string;
  readonly campaignId?: string;
  readonly adSetId?: string;
  readonly creativeId?: string;
  readonly status?: string;
  readonly effectiveStatus?: string;
}
export interface HierarchyReadBack {
  readonly campaign: ProviderObject;
  readonly adSets: readonly ProviderObject[];
  readonly creatives: readonly ProviderObject[];
  readonly ads: readonly ProviderObject[];
}

/** Input must come from provider reads, never from the create response or UI counts. */
export function verifyHierarchy(
  plan: FrozenHierarchy,
  actual: HierarchyReadBack,
): {
  readonly verified: boolean;
  readonly errors: readonly string[];
} {
  const errors: string[] = [];
  const account = (id: string) => id.replace(/^act_/, "");
  if (actual.campaign.id !== plan.campaignId) errors.push("CAMPAIGN_MISMATCH");
  const owns = (o: ProviderObject) => account(o.accountId) === account(plan.adAccountId);
  if (![actual.campaign, ...actual.adSets, ...actual.creatives, ...actual.ads].every(owns))
    errors.push("ACCOUNT_MISMATCH");
  if (actual.campaign.status !== plan.configuredStatus) errors.push("CAMPAIGN_STATUS_MISMATCH");
  const groups = [
    ["ADSET", plan.expectedAdSetCount, plan.adSets, actual.adSets],
    ["CREATIVE", plan.expectedCreativeCount, plan.creatives, actual.creatives],
    ["AD", plan.expectedAdCount, plan.ads, actual.ads],
  ] as const;
  for (const [name, count, expected, observed] of groups) {
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      expected.length !== count ||
      observed.length !== count ||
      new Set(expected.map((o) => o.id)).size !== count ||
      new Set(observed.map((o) => o.id)).size !== count ||
      expected.some((o) => !observed.some((v) => v.id === o.id))
    )
      errors.push(`${name}_COUNT_OR_ID_MISMATCH`);
  }
  for (const adSet of actual.adSets) {
    if (adSet.campaignId !== plan.campaignId) errors.push("ADSET_PARENT_MISMATCH");
    if (adSet.status !== plan.configuredStatus) errors.push("ADSET_STATUS_MISMATCH");
  }
  for (const expected of plan.ads) {
    const ad = actual.ads.find((o) => o.id === expected.id);
    if (
      !plan.adSets.some((o) => o.id === expected.adSetId) ||
      !plan.creatives.some((o) => o.id === expected.creativeId) ||
      !ad ||
      ad.adSetId !== expected.adSetId ||
      ad.creativeId !== expected.creativeId ||
      ad.campaignId !== plan.campaignId
    )
      errors.push("AD_MAPPING_MISMATCH");
    if (ad?.status !== plan.configuredStatus) errors.push("AD_STATUS_MISMATCH");
  }
  // ACTIVE configured status is deliberately not a claim of LIVE delivery.
  return { verified: errors.length === 0, errors: [...new Set(errors)] };
}
