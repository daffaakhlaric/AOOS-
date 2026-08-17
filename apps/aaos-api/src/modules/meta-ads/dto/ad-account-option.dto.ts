/**
 * `GET /api/v1/meta-ads/accounts` response entry — one per `AaosApiConfig.META_AD_ACCOUNT_IDS`
 * entry, backing the dashboard's multi-account pill selector
 * (`docs/PROMPT-AAOS-DASHBOARD-LEAD-SPEND-CABANG-SOURCE.md` coordinator note #6). `name` is
 * resolved via `IMetaAdsClient.getAdAccount` (Meta Graph API `GET /{ad_account_id}?fields=name`);
 * see `MetaAdsService.getAdAccounts` for the graceful per-account fallback if that lookup fails.
 */
export interface AdAccountOptionDto {
  readonly id: string;
  readonly name: string;
}
