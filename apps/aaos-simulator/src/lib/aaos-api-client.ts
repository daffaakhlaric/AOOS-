import type { PropertyListingData } from "@aos/conversation-simulator";

/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 8 (spec section 12 point 3/4) — thin fetch wrappers
 * to real `apps/aaos-api` endpoints. `fetchListingById` resolves the real listing data for a
 * `vertical: "PROPERTY"` simulation request's `listingId` (used by both `POST /api/simulate` and
 * `POST /api/simulate-all`). Mirrors `apps/aaos-dashboard`'s `src/lib/api.ts` `callAaosApi` — same
 * `AAOS_API_BASE_URL`/`AAOS_API_KEY` env var convention, same `x-api-key` header
 * `apps/aaos-api`'s `ApiKeyGuard` requires — but deliberately narrower (one real call per function,
 * no generic `callAaosApi<T>` abstraction).
 *
 * Real tenant-selector task additions: `fetchTenants` (`GET /api/v1/superadmin/tenants`, used by
 * `GET /api/tenants`) and `fetchActiveListings` (`GET /api/v1/listings?status=AKTIF`, used by
 * `GET /api/listings`) — see each function's own doc for the real mechanism/auth-tier reasoning.
 *
 * Server-only by construction: only ever called from `src/app/api/**` Route Handlers, which always
 * run on the server.
 *
 * Never throws — a missing/misconfigured `AAOS_API_BASE_URL`/`AAOS_API_KEY`, a network failure, a
 * non-2xx response, or an unexpected body shape all resolve to an honest "no real data available"
 * outcome (never a fabricated one) so a fetch failure here never fails the whole request;
 * `ClaraSimulationComposer`'s PROPERTY branch already composes successfully with 0 listings.
 */

interface AaosApiListingResponse {
  readonly id: string;
  readonly title: string;
  readonly propertyType: string;
  readonly price: number;
  readonly city?: string;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly landArea?: number;
  readonly buildArea?: number;
  readonly waNumber?: string;
  readonly mainPhotoUrl?: string;
}

interface AaosApiPromptOverrideResponse {
  readonly agent: string;
  readonly promptKey: string;
  readonly content: string;
  readonly isActive: boolean;
}

function isPromptOverrideResponseArray(value: unknown): value is AaosApiPromptOverrideResponse[] {
  return (
    Array.isArray(value) &&
    value.every(
      (row) =>
        typeof row === "object" &&
        row !== null &&
        typeof (row as Partial<AaosApiPromptOverrideResponse>).agent === "string" &&
        typeof (row as Partial<AaosApiPromptOverrideResponse>).promptKey === "string" &&
        typeof (row as Partial<AaosApiPromptOverrideResponse>).content === "string" &&
        typeof (row as Partial<AaosApiPromptOverrideResponse>).isActive === "boolean",
    )
  );
}

const CLARA_SYSTEM_PROMPT_KEY = "clara_system_prompt";
/**
 * PROPERTY LLM wiring — the real PROPERTY-vertical sibling `prompt_key` to
 * `CLARA_SYSTEM_PROMPT_KEY`, added to `apps/aaos-api`'s `KNOWN_PROMPT_KEYS`
 * (`apps/aaos-api/src/modules/llm/llm.service.ts`) alongside this change.
 */
const CLARA_PROPERTY_SYSTEM_PROMPT_KEY = "clara_property_system_prompt";

/**
 * A real, honest outcome of trying to fetch the active Clara system-prompt override — never
 * fabricated, so the caller can always tell a real applied override apart from a real, legitimate
 * "nothing to apply" (per the task's own explicit "add a real, honest way to tell whether an
 * override was actually applied" requirement).
 */
export type ClaraPromptOverrideFetchResult =
  | { readonly found: true; readonly content: string }
  | { readonly found: false; readonly reason: string };

/**
 * Fetches the real, currently-active Clara system-prompt override for `tenantId` from
 * `apps/aaos-api`'s `GET /api/v1/learning/prompt-overrides/:tenantId/active` (AAOS Self-Learning
 * AI, Phase C wiring — the real, first live caller of `@aos/sales-agent`'s pre-existing
 * `promptOverride` parameter). Mirrors `fetchListingById`'s exact contract: same
 * `AAOS_API_BASE_URL`/`AAOS_API_KEY`/`x-api-key` convention, same never-throwing discipline — a
 * missing/misconfigured env var, a network failure, a non-2xx response, or an unexpected body
 * shape all resolve to `{ found: false, reason }` (an honest "no active override available", not a
 * fabricated one), so `ClaraSimulationComposer` always falls back to composing with
 * `promptOverride: undefined` (today's real, unchanged behavior) rather than ever failing the
 * simulation itself. Unlike `fetchListingById`, the failure reason is preserved (not collapsed to
 * `undefined`) so the caller can report an honest, specific status back to the user.
 *
 * The endpoint already returns only `is_active = true` rows (`PromptOverrideRepository.
 * listActiveForTenant`'s own `.eq("is_active", true)` filter — verified by direct read), so the
 * `isActive` check below is a defensive belt-and-suspenders, not the primary filter; the real
 * client-side filter this function applies is `agent === "CLARA" && promptKey === promptKey`
 * (the caller's own resolved key), per the task's own instruction.
 *
 * PROPERTY LLM wiring: vertical-aware — `promptKey` defaults to `CLARA_SYSTEM_PROMPT_KEY`
 * (AUTOMOTIVE, today's exact unchanged behavior for every existing caller that doesn't pass this
 * argument) but a caller resolving for `vertical === "PROPERTY"` passes
 * `CLARA_PROPERTY_SYSTEM_PROMPT_KEY` explicitly (see the exported constant + both `POST
 * /api/simulate*` routes, which no longer skip this fetch for PROPERTY — that "PROPERTY vertical
 * has no LLM prompt path" comment was accurate before the PROPERTY LLM wiring task and is now
 * outdated).
 */
export async function fetchActiveClaraPromptOverride(
  tenantId: string,
  promptKey: string = CLARA_SYSTEM_PROMPT_KEY,
): Promise<ClaraPromptOverrideFetchResult> {
  const baseUrl = process.env["AAOS_API_BASE_URL"];
  const apiKey = process.env["AAOS_API_KEY"];
  if (
    baseUrl === undefined ||
    baseUrl.length === 0 ||
    apiKey === undefined ||
    apiKey.length === 0
  ) {
    return {
      found: false,
      reason: "AAOS_API_BASE_URL/AAOS_API_KEY belum dikonfigurasi di aaos-simulator.",
    };
  }
  if (tenantId.length === 0) {
    return { found: false, reason: "tenantId kosong." };
  }

  let response: Response;
  try {
    response = await fetch(
      new URL(`/api/v1/learning/prompt-overrides/${tenantId}/active`, baseUrl),
      { method: "GET", headers: { "x-api-key": apiKey }, cache: "no-store" },
    );
  } catch (caught) {
    return {
      found: false,
      reason: `Gagal terhubung ke aaos-api: ${caught instanceof Error ? caught.message : String(caught)}`,
    };
  }

  if (!response.ok) {
    return { found: false, reason: `aaos-api merespons status ${String(response.status)}.` };
  }

  let data: unknown;
  try {
    const text = await response.text();
    data = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    return { found: false, reason: "aaos-api mengembalikan body non-JSON." };
  }

  if (!isPromptOverrideResponseArray(data)) {
    return {
      found: false,
      reason: "aaos-api merespons 2xx tapi body tidak sesuai bentuk yang diharapkan.",
    };
  }

  const match = data.find(
    (row) => row.agent === "CLARA" && row.promptKey === promptKey && row.isActive,
  );
  if (match === undefined) {
    return {
      found: false,
      reason: `Tidak ada active override untuk (${tenantId}, CLARA, ${promptKey}).`,
    };
  }
  return { found: true, content: match.content };
}

/**
 * Resolves the real `prompt_key` `fetchActiveClaraPromptOverride` should look up for a given
 * simulator vertical (PROPERTY LLM wiring) — the single source of truth both `POST
 * /api/simulate`/`POST /api/simulate-all` use, so the AUTOMOTIVE/PROPERTY choice never drifts
 * between the two routes.
 */
export function resolveClaraPromptKeyForVertical(vertical: "AUTOMOTIVE" | "PROPERTY"): string {
  return vertical === "PROPERTY" ? CLARA_PROPERTY_SYSTEM_PROMPT_KEY : CLARA_SYSTEM_PROMPT_KEY;
}

/**
 * Real tenant summary for the tenant selector (task: "Remove the tenant hardcode"). Sourced from
 * `apps/aaos-api`'s `GET /api/v1/superadmin/tenants` — the SAME `x-api-key`-only perimeter every
 * other call in this file already sits behind (that controller's own doc confirms the real
 * `role === 'superadmin'` check happens one layer up, in `apps/aaos-dashboard`'s own
 * `/api/superadmin/*` route handlers reading a real dashboard session — `aaos-api` itself has no
 * notion of "which dashboard user", only "a trusted caller holding the shared api key", exactly
 * like every other `x-api-key`-gated endpoint this file already calls). This app is an internal
 * tool that already holds `AAOS_API_KEY` server-side, so it sits at the SAME trust tier as every
 * other real caller of this endpoint — no new/weaker auth mechanism invented.
 *
 * Includes `vertical` directly (`TenantResponseDto.vertical`, confirmed by direct read of
 * `apps/aaos-api`'s `tenant-response.dto.ts`): the real data model fixes exactly ONE vertical per
 * tenant row (not a list, not ambiguous), so the selector below can auto-resolve the vertical for
 * a chosen tenant rather than needing a second, separate AUTOMOTIVE/PROPERTY picker.
 */
export interface TenantSummary {
  readonly tenantId: string;
  readonly name: string;
  readonly vertical: "AUTOMOTIVE" | "PROPERTY";
}

export type FetchTenantsResult =
  | { readonly ok: true; readonly tenants: readonly TenantSummary[] }
  | { readonly ok: false; readonly reason: string };

function isTenantSummary(value: unknown): value is TenantSummary {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<TenantSummary>;
  return (
    typeof candidate.tenantId === "string" &&
    typeof candidate.name === "string" &&
    (candidate.vertical === "AUTOMOTIVE" || candidate.vertical === "PROPERTY")
  );
}

/**
 * Fetches the real list of tenants from `apps/aaos-api`'s `GET /api/v1/superadmin/tenants`. Never
 * throws — same discipline as every other function in this file: a missing/misconfigured env var,
 * a network failure, a non-2xx response, or an unexpected body shape all resolve to
 * `{ ok: false, reason }` (an honest "no real tenant list available"), NEVER a fabricated/hardcoded
 * tenant list.
 */
export async function fetchTenants(): Promise<FetchTenantsResult> {
  const baseUrl = process.env["AAOS_API_BASE_URL"];
  const apiKey = process.env["AAOS_API_KEY"];
  if (
    baseUrl === undefined ||
    baseUrl.length === 0 ||
    apiKey === undefined ||
    apiKey.length === 0
  ) {
    return {
      ok: false,
      reason: "AAOS_API_BASE_URL/AAOS_API_KEY belum dikonfigurasi di aaos-simulator.",
    };
  }

  let response: Response;
  try {
    response = await fetch(new URL("/api/v1/superadmin/tenants", baseUrl), {
      method: "GET",
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
  } catch (caught) {
    return {
      ok: false,
      reason: `Gagal terhubung ke aaos-api: ${caught instanceof Error ? caught.message : String(caught)}`,
    };
  }

  if (!response.ok) {
    return { ok: false, reason: `aaos-api merespons status ${String(response.status)}.` };
  }

  let data: unknown;
  try {
    const text = await response.text();
    data = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    return { ok: false, reason: "aaos-api mengembalikan body non-JSON." };
  }

  const tenantsRaw =
    typeof data === "object" && data !== null && "tenants" in data
      ? (data as { tenants: unknown }).tenants
      : undefined;
  if (!Array.isArray(tenantsRaw) || !tenantsRaw.every(isTenantSummary)) {
    return {
      ok: false,
      reason: "aaos-api merespons 2xx tapi body tidak sesuai bentuk yang diharapkan.",
    };
  }

  return { ok: true, tenants: tenantsRaw };
}

/** Real active-listing summary for the PROPERTY listing picker (task point 3). */
export interface ListingSummary {
  readonly id: string;
  readonly title: string;
  readonly propertyType: string;
  readonly price: number;
  readonly city?: string;
}

export type FetchActiveListingsResult =
  | { readonly ok: true; readonly listings: readonly ListingSummary[] }
  | { readonly ok: false; readonly reason: string };

function isListingSummary(value: unknown): value is ListingSummary {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<ListingSummary>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.propertyType === "string" &&
    typeof candidate.price === "number"
  );
}

/**
 * Fetches `tenantId`'s real active (`status=AKTIF`) listings from `apps/aaos-api`'s
 * `GET /api/v1/listings?status=AKTIF`, the same real endpoint/query-shape
 * `apps/aaos-dashboard`'s `PropertyObjectiveForm.tsx` already uses for its own listing picker.
 * Tenant-scoped via the real `x-tenant-id` header `apps/aaos-api`'s `TenantId()` decorator reads
 * (`common/tenant-context.ts`) — same convention `learning-bridge.ts` already establishes for this
 * app. Never throws — same discipline as `fetchTenants` above.
 */
export async function fetchActiveListings(tenantId: string): Promise<FetchActiveListingsResult> {
  const baseUrl = process.env["AAOS_API_BASE_URL"];
  const apiKey = process.env["AAOS_API_KEY"];
  if (
    baseUrl === undefined ||
    baseUrl.length === 0 ||
    apiKey === undefined ||
    apiKey.length === 0
  ) {
    return {
      ok: false,
      reason: "AAOS_API_BASE_URL/AAOS_API_KEY belum dikonfigurasi di aaos-simulator.",
    };
  }
  if (tenantId.length === 0) {
    return { ok: false, reason: "tenantId kosong." };
  }

  let response: Response;
  try {
    response = await fetch(new URL("/api/v1/listings?status=AKTIF", baseUrl), {
      method: "GET",
      headers: { "x-api-key": apiKey, "x-tenant-id": tenantId },
      cache: "no-store",
    });
  } catch (caught) {
    return {
      ok: false,
      reason: `Gagal terhubung ke aaos-api: ${caught instanceof Error ? caught.message : String(caught)}`,
    };
  }

  if (!response.ok) {
    return { ok: false, reason: `aaos-api merespons status ${String(response.status)}.` };
  }

  let data: unknown;
  try {
    const text = await response.text();
    data = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    return { ok: false, reason: "aaos-api mengembalikan body non-JSON." };
  }

  const listingsRaw =
    typeof data === "object" && data !== null && "listings" in data
      ? (data as { listings: unknown }).listings
      : undefined;
  if (!Array.isArray(listingsRaw) || !listingsRaw.every(isListingSummary)) {
    return {
      ok: false,
      reason: "aaos-api merespons 2xx tapi body tidak sesuai bentuk yang diharapkan.",
    };
  }

  return {
    ok: true,
    listings: listingsRaw.map((row) => ({
      id: row.id,
      title: row.title,
      propertyType: row.propertyType,
      price: row.price,
      ...(row.city !== undefined ? { city: row.city } : {}),
    })),
  };
}

const VALID_PROPERTY_TYPES: ReadonlySet<string> = new Set([
  "RUMAH",
  "APARTEMEN",
  "RUKO",
  "TANAH",
  "VILLA",
]);

function isValidListingResponse(value: unknown): value is AaosApiListingResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<AaosApiListingResponse>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.propertyType === "string" &&
    VALID_PROPERTY_TYPES.has(candidate.propertyType) &&
    typeof candidate.price === "number"
  );
}

/**
 * Fetches one real listing by id from `apps/aaos-api`'s `GET /api/v1/listings/:id`, mapped into
 * `@aos/conversation-simulator`'s `PropertyListingData` wire shape. Returns `undefined` on any
 * failure — see class-level doc.
 */
export async function fetchListingById(
  listingId: string,
): Promise<PropertyListingData | undefined> {
  const baseUrl = process.env["AAOS_API_BASE_URL"];
  const apiKey = process.env["AAOS_API_KEY"];
  if (
    baseUrl === undefined ||
    baseUrl.length === 0 ||
    apiKey === undefined ||
    apiKey.length === 0
  ) {
    return undefined;
  }

  let response: Response;
  try {
    response = await fetch(new URL(`/api/v1/listings/${listingId}`, baseUrl), {
      method: "GET",
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
  } catch {
    return undefined;
  }

  if (!response.ok) {
    return undefined;
  }

  let data: unknown;
  try {
    const text = await response.text();
    data = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }

  if (!isValidListingResponse(data)) {
    return undefined;
  }

  return {
    id: data.id,
    title: data.title,
    propertyType: data.propertyType as PropertyListingData["propertyType"],
    price: data.price,
    ...(data.city !== undefined ? { city: data.city } : {}),
    ...(data.bedrooms !== undefined ? { bedrooms: data.bedrooms } : {}),
    ...(data.bathrooms !== undefined ? { bathrooms: data.bathrooms } : {}),
    ...(data.landArea !== undefined ? { landArea: data.landArea } : {}),
    ...(data.buildArea !== undefined ? { buildArea: data.buildArea } : {}),
    ...(data.waNumber !== undefined ? { waNumber: data.waNumber } : {}),
    ...(data.mainPhotoUrl !== undefined ? { mainPhotoUrl: data.mainPhotoUrl } : {}),
  };
}
