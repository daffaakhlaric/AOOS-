import { Injectable } from "@nestjs/common";

import { ResponseCache } from "../llm/cache/ResponseCache.js";

import type { RegionOptionDto } from "./dto/region.dto.js";
import { fetchDistricts, fetchProvinces, fetchRegencies } from "./infrastructure/wilayah-client.js";

/** This data is essentially static (real Indonesian government administrative boundaries) — a
 * 24h TTL is an honest reflection of that, not a correctness compromise like the per-tenant Meta
 * caches this session fixed elsewhere (`c8d739c`). */
const REGION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * `modules/region` — thin, read-only proxy over the real public `ibnux.github.io/data-indonesia`
 * wilayah catalog (see `infrastructure/wilayah-client.ts`'s class doc), backing the Listing form's
 * real cascading province -> kabupaten/kota -> kecamatan `<select>` chain
 * (`docs/PROMPT-AAOS-GEO-TARGETING-AND-REGION-PICKER.md` Part B).
 *
 * Deliberately NOT tenant-scoped — this is public reference data (Indonesian administrative
 * boundaries), not per-tenant data, so no `tenantId` parameter anywhere in this module, unlike
 * every other real `aaos-api` service. Still sits behind the same `ApiKeyGuard` perimeter every
 * other controller in this app uses (`RegionController`), since it's still a real backend
 * endpoint, not a public unauthenticated one.
 *
 * Reuses `ResponseCache` (`modules/llm/cache/ResponseCache.ts`) verbatim rather than inventing a
 * second in-memory TTL cache — the exact same "tiny in-memory, TTL-expiring, SHA-256-keyed"
 * pattern already established there, just with a much longer TTL appropriate for near-static
 * reference data instead of LLM responses.
 */
@Injectable()
export class RegionService {
  private readonly cache = new ResponseCache<readonly RegionOptionDto[]>(REGION_CACHE_TTL_MS);

  async getProvinces(): Promise<readonly RegionOptionDto[]> {
    const cached = this.cache.get("provinces", null);
    if (cached !== undefined) {
      return cached;
    }
    const result = await fetchProvinces();
    this.cache.set("provinces", null, result);
    return result;
  }

  async getRegencies(provinceId: string): Promise<readonly RegionOptionDto[]> {
    const cached = this.cache.get("regencies", provinceId);
    if (cached !== undefined) {
      return cached;
    }
    const result = await fetchRegencies(provinceId);
    this.cache.set("regencies", provinceId, result);
    return result;
  }

  async getDistricts(regencyId: string): Promise<readonly RegionOptionDto[]> {
    const cached = this.cache.get("districts", regencyId);
    if (cached !== undefined) {
      return cached;
    }
    const result = await fetchDistricts(regencyId);
    this.cache.set("districts", regencyId, result);
    return result;
  }
}
