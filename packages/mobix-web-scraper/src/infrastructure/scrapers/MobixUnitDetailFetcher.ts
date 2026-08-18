import { err, ok, type Result } from "@aos/common";

import type { IUnitDetailFetcher, UnitDetail } from "../../contracts/IUnitDetailFetcher.js";
import { ParseError } from "../../domain/errors/ParseError.js";
import { ScrapeError } from "../../domain/errors/ScrapeError.js";
import { DETAIL_API_PATH, postJson, resolveApiOrigin } from "../api/MobixApiClient.js";
import { mobixDetailResponseSchema } from "../api/MobixApiSchemas.js";
import { absolutePhotoUrl } from "../api/MobixUnitMapper.js";

export interface MobixUnitDetailFetcherOptions {
  /** Same public listing URL the inventory scraper takes; only its origin is used. */
  readonly listingUrl: string;
  /** Explicit API origin override, bypassing `listingUrl` derivation. */
  readonly apiBaseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

/**
 * Fetches ONE unit's full detail from mobixbydss.id's real `POST /api/get-detail-produk`
 * (body `{"slug": "…"}`) and returns its COMPLETE gallery as absolute URLs.
 *
 * This is what makes the "12 foto per unit" expectation real again after the API migration: the
 * listing endpoint only carries a single `thumbnail`, so without this fetch each newly-detected unit
 * would ingest exactly one photo. `galeri[].url` values are site-relative
 * (`/unit-file-serve?path=…`), so each is resolved against the API origin before being handed to
 * `DownloadAndStorePhotos`.
 */
export class MobixUnitDetailFetcher implements IUnitDetailFetcher {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: MobixUnitDetailFetcherOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async fetchDetail(slug: string): Promise<Result<UnitDetail, ScrapeError | ParseError>> {
    if (typeof slug !== "string" || slug.trim().length === 0) {
      return err(new ScrapeError("MobixUnitDetailFetcher: slug must be a non-empty string"));
    }

    const originResult = this.options.apiBaseUrl
      ? resolveApiOrigin(this.options.apiBaseUrl)
      : resolveApiOrigin(this.options.listingUrl);
    if (!originResult.ok) {
      return err(originResult.error);
    }
    const origin = originResult.value;
    const endpoint = `${origin}${DETAIL_API_PATH}`;

    const body = await postJson(this.fetchImpl, endpoint, { slug }, "MobixUnitDetailFetcher");
    if (!body.ok) {
      return err(body.error);
    }

    const parsed = mobixDetailResponseSchema.safeParse(body.value);
    if (!parsed.success) {
      return err(
        new ParseError(
          `MobixUnitDetailFetcher: detail response for "${slug}" did not match the expected API ` +
            `shape: ` +
            parsed.error.issues
              .map((issue) => `${issue.path.join(".")} ${issue.message}`)
              .join("; "),
        ),
      );
    }

    const detail = parsed.data.data;
    const photos = (detail.galeri ?? []).map((entry) => absolutePhotoUrl(entry.url));

    return ok({
      slug: detail.slug,
      photos,
      ...(detail.deskripsi !== undefined ? { description: detail.deskripsi } : {}),
    });
  }
}
