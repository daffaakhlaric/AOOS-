import { propertyBranchAudienceDefault } from "@aos/meta-ads-connector";
import { Injectable } from "@nestjs/common";

import type { ResolveLocationRequestDto } from "../llm/dto/resolve-location.dto.js";
import { LlmService } from "../llm/llm.service.js";

export interface LocationResolverInput {
  readonly listingTitle: string;
  readonly propertyType: string;
  readonly price: number;
  readonly city?: string;
  readonly province?: string;
  readonly address?: string;
  readonly branchId?: string;
}

/** Real, resolved city+radius (+ display-only age range) target for one PROPERTY listing. */
export interface ResolvedLocation {
  readonly cities: readonly string[];
  readonly radiusKm: number;
  readonly ageMin: number;
  readonly ageMax: number;
  /** `"LLM"` when `LlmService.resolveLocation` returned a real, validated answer; `"FALLBACK"` when it degraded (no API key / rate-limited / provider error / invalid response) and `propertyBranchAudienceDefault` was used instead. */
  readonly source: "LLM" | "FALLBACK";
  readonly reasoning: string;
}

/**
 * `modules/location-resolver` (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase C point 1) — PROPERTY-only.
 * Does NOT touch `AreaPriority`/`Branch`/`BranchAudienceDefaults.ts` (the AUTOMOTIVE-side files) —
 * those keep governing `dss-motor`'s targeting unchanged.
 *
 * Real LLM call (`LlmService.resolveLocation`) resolving city+radius per listing, using
 * `LlmService`'s established cache→gate→OpenAI(jsonMode)→Zod-validate→cache→degrade convention —
 * no freestanding OpenAI client here.
 *
 * Real deterministic fallback (Phase C point 2): when the LLM call degrades for ANY reason
 * (`available: false` — `NO_API_KEY`/`RATE_LIMITED`/`PROVIDER_ERROR`/`INVALID_RESPONSE`), this
 * service falls back to `propertyBranchAudienceDefault(branchId)` from
 * `@aos/meta-ads-connector`'s `PropertyBranchAudienceDefaults.ts` — the existing, hand-curated,
 * "initial defaults pending business review" table (BINTARO/CINERE/JAKARTA/BANDUNG/SURABAYA, `UMUM`
 * fallback for anything unrecognized) — REUSED as-is, never a fresh hand-rolled default function.
 */
@Injectable()
export class LocationResolverService {
  constructor(private readonly llmService: LlmService) {}

  async resolve(input: LocationResolverInput): Promise<ResolvedLocation> {
    const request: ResolveLocationRequestDto = {
      listingTitle: input.listingTitle,
      propertyType: input.propertyType,
      price: input.price,
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.province !== undefined ? { province: input.province } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
    };

    const response = await this.llmService.resolveLocation(request);
    if (response.available) {
      return {
        cities: response.cities,
        radiusKm: response.radiusKm,
        ageMin: response.ageMin,
        ageMax: response.ageMax,
        source: "LLM",
        reasoning: response.reasoning,
      };
    }

    const fallback = propertyBranchAudienceDefault(input.branchId);
    return {
      cities: fallback.cities,
      radiusKm: fallback.radiusKm,
      ageMin: fallback.ageMin,
      ageMax: fallback.ageMax,
      source: "FALLBACK",
      reasoning: `AI resolve-location tidak tersedia (${response.reason}) — pakai default cabang "${(input.branchId ?? "UMUM").toUpperCase()}". ${fallback.note}`,
    };
  }
}
