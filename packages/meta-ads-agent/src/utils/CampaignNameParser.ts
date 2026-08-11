import { classifyFunnel, extractBranch, type Branch, type Funnel } from "@aos/meta-ads-connector";

export interface ParsedCampaignName {
  readonly funnel: Funnel;
  readonly branch: Branch;
}

/** Extracts funnel + branch from a raw campaign name, per the spec's "Campaign Naming Conventions" — thin composition over `@aos/meta-ads-connector`'s `classifyFunnel`/`extractBranch`. */
export class CampaignNameParser {
  static parse(name: string): ParsedCampaignName {
    return { funnel: classifyFunnel(name), branch: extractBranch(name) };
  }
}
