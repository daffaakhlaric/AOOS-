import { err, ok, type Result } from "@aos/common";

import { ScrapeError } from "../../domain/errors/ScrapeError.js";

/** `POST /api/get-all-produk` — paginated unit listing. Body: `{"page": N}`, 1-indexed. */
export const LISTING_API_PATH = "/api/get-all-produk";
/** `POST /api/get-detail-produk` — one unit's full detail. Body: `{"slug": "…"}`. */
export const DETAIL_API_PATH = "/api/get-detail-produk";

/**
 * Derives the API origin from the configured public listing URL.
 *
 * DESIGN CHOICE: the scrapers keep taking the human-facing `listingUrl`
 * (`https://mobixbydss.id/produk`, which is what `MOBIX_LISTING_URL` /
 * `MobixScraperFactory.DEFAULT_LISTING_URL` are set to and what operators recognize) and derive the
 * API base from its ORIGIN, rather than making callers configure a second, redundant URL. The API
 * paths are fixed properties of the mobixbydss.id backend, not deployment config — only the origin
 * varies (e.g. pointing at a staging host). Callers that genuinely need to override the base can
 * still pass `apiBaseUrl` explicitly.
 */
export function resolveApiOrigin(listingUrl: string): Result<string, ScrapeError> {
  try {
    return ok(new URL(listingUrl).origin);
  } catch {
    return err(
      new ScrapeError(
        `MobixApiClient: listingUrl must be an absolute URL, received: ${listingUrl}`,
      ),
    );
  }
}

/**
 * POSTs a JSON body to a mobixbydss.id API endpoint and returns the decoded JSON.
 *
 * The real API needs no auth and no special headers beyond `Content-Type: application/json`
 * (confirmed against the live endpoints on 2026-08-17). Shared by `MobixInventoryScraper` and
 * `MobixUnitDetailFetcher` so both get identical network-, status-, and malformed-JSON error
 * handling.
 */
export async function postJson(
  fetchImpl: typeof fetch,
  url: string,
  body: Readonly<Record<string, unknown>>,
  context: string,
): Promise<Result<unknown, ScrapeError>> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    return err(
      new ScrapeError(`${context}: fetch failed for ${url}`, {
        cause: error instanceof Error ? error : undefined,
      }),
    );
  }

  if (!response.ok) {
    return err(new ScrapeError(`${context}: ${url} responded with status ${response.status}`));
  }

  try {
    return ok((await response.json()) as unknown);
  } catch (error) {
    return err(
      new ScrapeError(`${context}: ${url} returned a body that is not valid JSON`, {
        cause: error instanceof Error ? error : undefined,
      }),
    );
  }
}
