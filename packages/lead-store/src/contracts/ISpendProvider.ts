/**
 * Judgment call (design resolution #3): the spec's `GetClosingStats.rphSpkByCampaign` pinned
 * example (spend=564000, closings=3 → rphSpk=188000) requires per-campaign ad spend, which is
 * NOT stored in any `lead-store` table — it lives in `@aos/meta-ads-connector`'s `AdAccountRegistry`
 * (`Campaign.spend`). Rather than take a structural dependency on that registry's shape directly
 * inside `GetClosingStats`, this package defines its own minimal port (Dependency Inversion,
 * Constitution's Clean Architecture rule) that `infrastructure/adapters/MetaAdsSpendAdapter.ts`
 * implements against the real `@aos/meta-ads-connector` `AdAccountRegistry` export. Tests inject a
 * hand-rolled mock matching this exact interface.
 */
export interface ISpendProvider {
  /** Returns total spend per campaign id, for the given campaign ids. Campaign ids not found resolve to `0`, never absent. */
  getSpendByCampaign(campaignIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
}
