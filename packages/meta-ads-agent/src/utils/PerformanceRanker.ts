import type { PerAdFinding } from "../types/AgentTypes.js";

export interface RankedPerformer {
  readonly label: string;
  readonly rphChatIDR: number;
  readonly conversations: number;
}

/** Ranks ads by Rp/chat (ascending — lowest/cheapest first) and other multi-metric orderings. */
export class PerformanceRanker {
  /** Findings with a defined `rphChatIDR`, ascending (cheapest first). Findings with `null` rphChat are excluded — there is no rate to rank by. */
  static byRphChatAscending(findings: ReadonlyArray<PerAdFinding>): ReadonlyArray<PerAdFinding> {
    // Both operands are already filtered to non-null `rphChatIDR` above — asserted, not defaulted.
    return findings
      .filter((f) => f.rphChatIDR !== null)
      .sort((a, b) => (a.rphChatIDR as number) - (b.rphChatIDR as number));
  }

  /** The `count` cheapest (best) performers by Rp/chat, formatted for `DailyDigest.topPerformers`. */
  static topPerformers(
    findings: ReadonlyArray<PerAdFinding>,
    count: number,
  ): ReadonlyArray<RankedPerformer> {
    // `byRphChatAscending` already filtered out null `rphChatIDR` values — asserted, not defaulted.
    return PerformanceRanker.byRphChatAscending(findings)
      .slice(0, count)
      .map((f) => ({
        label: f.adId,
        rphChatIDR: f.rphChatIDR as number,
        conversations: f.conversations,
      }));
  }
}
