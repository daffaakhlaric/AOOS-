import { Inject, Injectable, Logger } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, META_ADS_CONNECTOR_REGISTRY } from "../../di-tokens.js";
import type { MetaAdsConnectorRegistry } from "../meta-ads/infrastructure/meta-ads-connector-registry.js";

import type { StoredMetaInterest } from "./domain/meta-interest.js";
import {
  INTERESTS_BY_VERTICAL,
  type MetaInterestResponseDto,
  type SyncInterestsBodyDto,
  type SyncInterestsResponseDto,
  type SyncInterestsTermResultDto,
} from "./dto/sync-interests.dto.js";
import { MetaInterestRepository } from "./infrastructure/meta-interest.repository.js";

/**
 * `POST /api/v1/meta-interests/sync` + `GET /api/v1/meta-interests` (AAOS-SIMULASI-TARGETING).
 *
 * The sync runs `@aos/meta-ads-connector`'s real `SearchAdInterests` use case once per curated
 * search term against the LIVE Meta Graph API (`GET /search?type=adinterest`) and upserts what
 * comes back into `meta_interests`. It is a manually-triggered endpoint by design — no scheduler,
 * no cron, no startup hook — matching this codebase's standing "no scheduling infrastructure"
 * boundary; a human (or an external cron hitting the URL) decides when the catalogue is refreshed.
 *
 * FAILURE POLICY: one term failing must not lose the terms that succeeded. Each term's real
 * outcome is reported individually in the response (`ok: false` + the real error message), and the
 * request as a whole still returns 200 — a half-refreshed catalogue is a real, honest state, and
 * throwing would hide which terms actually worked. Nothing is ever written for a failed term.
 *
 * HARD SCOPE BOUNDARY: this module only READS Meta's interest catalogue. It never creates,
 * modifies, or targets a real campaign — `CreateCampaign`/`CreateAdSet` are untouched by this
 * feature (the user's explicit decision), so real campaign creation behaves exactly as before.
 */
@Injectable()
export class MetaInterestsService {
  private readonly logger = new Logger(MetaInterestsService.name);

  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(META_ADS_CONNECTOR_REGISTRY)
    private readonly connectorRegistry: MetaAdsConnectorRegistry,
    private readonly repository: MetaInterestRepository,
  ) {}

  async sync(
    body: SyncInterestsBodyDto,
    now: Date = new Date(),
  ): Promise<SyncInterestsResponseDto> {
    const connectorResult = await this.connectorRegistry.resolve(this.config.AAOS_TENANT_ID);
    if (!connectorResult.ok) {
      throw connectorResult.error;
    }
    const connector = connectorResult.value;

    const terms = body.terms ?? INTERESTS_BY_VERTICAL[body.vertical ?? "AUTOMOTIVE"];
    const fetchedAt = now.toISOString();
    const results: SyncInterestsTermResultDto[] = [];

    for (const term of terms) {
      const searchResult = await connector.searchAdInterests.execute({
        term,
        accessToken: connector.accessToken,
        ...(body.limitPerTerm !== undefined ? { limit: body.limitPerTerm } : {}),
      });

      if (!searchResult.ok) {
        this.logger.warn(
          `meta-interests sync: term "${term}" failed: ${searchResult.error.message}`,
        );
        results.push({
          term,
          ok: false,
          error: searchResult.error.message,
          found: 0,
          inserted: 0,
          updated: 0,
        });
        continue;
      }

      let inserted = 0;
      let updated = 0;
      for (const interest of searchResult.value) {
        const outcome = await this.repository.save(
          {
            id: interest.id,
            tenantId: this.config.AAOS_TENANT_ID,
            name: interest.name,
            audienceSizeLower: interest.audienceSizeLower,
            audienceSizeUpper: interest.audienceSizeUpper,
            path: interest.path,
            ...(interest.topic !== undefined ? { topic: interest.topic } : {}),
            searchTerm: interest.searchTerm,
          },
          fetchedAt,
        );
        if (outcome === "inserted") {
          inserted += 1;
        } else {
          updated += 1;
        }
      }

      results.push({ term, ok: true, found: searchResult.value.length, inserted, updated });
    }

    return {
      tenantId: this.config.AAOS_TENANT_ID,
      fetchedAt,
      terms: results,
      totalInserted: results.reduce((sum, r) => sum + r.inserted, 0),
      totalUpdated: results.reduce((sum, r) => sum + r.updated, 0),
    };
  }

  async list(): Promise<readonly MetaInterestResponseDto[]> {
    const stored = await this.repository.listByTenant(this.config.AAOS_TENANT_ID);
    return stored.map(toResponseDto);
  }
}

function toResponseDto(interest: StoredMetaInterest): MetaInterestResponseDto {
  return {
    id: interest.id,
    name: interest.name,
    audienceSizeLower: interest.audienceSizeLower,
    audienceSizeUpper: interest.audienceSizeUpper,
    path: interest.path,
    ...(interest.topic !== undefined ? { topic: interest.topic } : {}),
    searchTerm: interest.searchTerm,
    fetchedAt: interest.fetchedAt,
  };
}
