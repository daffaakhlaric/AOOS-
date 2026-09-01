import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BASE = "https://graph.facebook.com/v21.0";

/** Shared MSW node server — mirrors `packages/meta-ads-connector/tests/helpers/msw.ts`'s pattern. Mocks live only in test code, never in production source, per this app's "no mocks in production code" constraint. */
export const mswServer = setupServer();

export interface MetaFixtureOptions {
  readonly campaignId?: string;
  readonly adSetId?: string;
  readonly adId?: string;
}

/**
 * Registers a happy-path Meta Marketing Graph API v21.0 fixture: one campaign -> one adset ->
 * one ad, each with enough `insights` data for `VerdictEngine` to compute a real (non-REVIEW)
 * verdict, plus a generic `POST /{id}` handler for verdict-execution mutations (pause/scale/fix).
 */
export function registerHappyPathMetaApiHandlers(options: MetaFixtureOptions = {}): void {
  const campaignId = options.campaignId ?? "120000000000001";
  const adSetId = options.adSetId ?? "120000000000002";
  const adId = options.adId ?? "120000000000003";

  mswServer.use(
    http.get(`${BASE}/:adAccountId/campaigns`, () =>
      HttpResponse.json({
        data: [
          {
            id: campaignId,
            name: "CTWA - Cinere - Test Drive",
            objective: "OUTCOME_ENGAGEMENT",
            status: "ACTIVE",
            created_time: "2026-01-01T00:00:00+0000",
            insights: {
              data: [
                {
                  spend: "1000000",
                  impressions: "50000",
                  reach: "20000",
                  clicks: "500",
                  actions: [
                    {
                      action_type: "onsite_conversion.messaging_conversation_started_7d",
                      value: "40",
                    },
                    { action_type: "onsite_conversion.total_messaging_connection", value: "45" },
                    { action_type: "onsite_conversion.lead", value: "5" },
                  ],
                  messaging_conversation_started: "45",
                },
              ],
            },
          },
        ],
      }),
    ),
    http.get(`${BASE}/${campaignId}/adsets`, () =>
      HttpResponse.json({
        data: [
          {
            id: adSetId,
            name: "AdSet - Cinere - Broad",
            status: "ACTIVE",
            daily_budget: "10000000",
            insights: { data: [{ spend: "500000" }] },
          },
        ],
      }),
    ),
    http.get(`${BASE}/${adSetId}/ads`, () =>
      HttpResponse.json({
        data: [
          {
            id: adId,
            name: "Ad - Cinere - Creative 1",
            status: "ACTIVE",
            created_time: "2026-01-01T00:00:00+0000",
            insights: {
              data: [
                {
                  spend: "250000",
                  impressions: "10000",
                  reach: "5000",
                  clicks: "100",
                  actions: [
                    {
                      action_type: "onsite_conversion.messaging_conversation_started_7d",
                      value: "20",
                    },
                    { action_type: "onsite_conversion.total_messaging_connection", value: "22" },
                    { action_type: "onsite_conversion.lead", value: "2" },
                  ],
                  messaging_conversation_started: "22",
                },
              ],
            },
          },
        ],
      }),
    ),
    http.post(`${BASE}/:id`, () => HttpResponse.json({ success: true })),
  );
}

/** Registers `GET /{ad_account_id}?fields=name` -> `{ id, name }`, for `MetaAdsService.getAdAccounts` happy-path tests (coordinator note #6, multi-account pill selector). */
export function registerAdAccountNameMswHandler(
  accountsById: Readonly<Record<string, string>>,
): void {
  mswServer.use(
    http.get(`${BASE}/:adAccountId`, ({ params }) => {
      const id = String(params["adAccountId"]);
      const name = accountsById[id];
      if (name === undefined) {
        return HttpResponse.json(
          { error: { message: "Unknown ad account", type: "OAuthException", code: 100 } },
          { status: 400 },
        );
      }
      return HttpResponse.json({ id, name });
    }),
  );
}

export function registerMetaApiErrorHandler(status: number, code?: number): void {
  mswServer.use(
    http.get(`${BASE}/:adAccountId/campaigns`, () =>
      HttpResponse.json(
        { error: { message: "Meta API error", type: "OAuthException", code: code ?? 1 } },
        { status },
      ),
    ),
  );
}

/** Registers a failing `POST /{id}` handler, for verdict-execution (pause/scale/fix) error-path tests. */
export function registerMetaApiPostErrorHandler(status: number, code?: number): void {
  mswServer.use(
    http.post(`${BASE}/:id`, () =>
      HttpResponse.json(
        { error: { message: "Meta API error", type: "OAuthException", code: code ?? 1 } },
        { status },
      ),
    ),
  );
}

/**
 * AAOS-W1D-S3: registers `POST /{ad-account}/campaigns` -> `{ id: newCampaignId }` and
 * `POST /{ad-account}/adsets` -> `{ id: newAdSetId }`, for `CampaignsService.createCampaign`
 * happy-path tests.
 */
export function registerCreateCampaignMswHandlers(
  options: { readonly newCampaignId?: string; readonly newAdSetId?: string } = {},
): void {
  const newCampaignId = options.newCampaignId ?? "120000000000099";
  const newAdSetId = options.newAdSetId ?? "120000000000100";
  mswServer.use(
    http.post(`${BASE}/:adAccountId/campaigns`, () => HttpResponse.json({ id: newCampaignId })),
    http.post(`${BASE}/:adAccountId/adsets`, () => HttpResponse.json({ id: newAdSetId })),
  );
}

/** AAOS-W1D-S3: registers a failing `POST /{ad-account}/campaigns` handler, for `CreateCampaign` error-path tests. */
export function registerCreateCampaignErrorHandler(status: number, code?: number): void {
  mswServer.use(
    http.post(`${BASE}/:adAccountId/campaigns`, () =>
      HttpResponse.json(
        { error: { message: "Meta API error", type: "OAuthException", code: code ?? 1 } },
        { status },
      ),
    ),
  );
}

/**
 * AAOS EPIC S, Phase S3/S4: registers `GET /search?type=adgeolocation&...` -> `{data: [...]}` for
 * `CampaignsService.createPropertyCampaign`'s real geo-search step. `citiesByQuery` maps a free-text
 * `q` value to the real Meta location rows it should resolve to — a query with no entry (or an
 * empty array) resolves to Meta's real, honest `{"data": []}` zero-match response.
 */
export function registerSearchAdLocationsMswHandler(
  citiesByQuery: Readonly<
    Record<string, ReadonlyArray<{ readonly key: string; readonly name: string }>>
  >,
): void {
  mswServer.use(
    http.get(`${BASE}/search`, ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get("type") !== "adgeolocation") {
        return HttpResponse.json({ data: [] });
      }
      const query = url.searchParams.get("q") ?? "";
      const rows = citiesByQuery[query] ?? [];
      return HttpResponse.json({
        data: rows.map((row) => ({
          key: row.key,
          name: row.name,
          type: "city",
          country_code: "ID",
        })),
      });
    }),
  );
}
