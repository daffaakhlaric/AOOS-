import { z } from "zod";

import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

/**
 * `LlmService.resolveLocation` request (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase C point 1) —
 * `LocationResolverService`'s only caller. PROPERTY-only: the fields mirror `CreateListingBodyDto`'s
 * "LOKASI" section (city/province/address) plus enough listing context (title/propertyType/price)
 * for the model to reason about who a real buyer for this listing would be, and `branchId` so the
 * prompt can anchor on a tenant-defined branch name when the listing itself has no explicit
 * city/province (mirrors `propertyBranchAudienceDefault`'s own branch-keyed fallback).
 */
export const ResolveLocationRequestSchema = z.object({
  listingTitle: z.string().min(1),
  propertyType: z.string().min(1),
  price: z.number().int().positive(),
  city: z.string().min(1).optional(),
  province: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  branchId: z.string().min(1).optional(),
});
export type ResolveLocationRequestDto = z.infer<typeof ResolveLocationRequestSchema>;

/**
 * The shape Samantha's `resolve-location` system prompt asks the model to return: a short list of
 * real Indonesian city names, a radius in km, and a display-only age range — same
 * `targeting.locations`/`ageMin`/`ageMax` vocabulary `CAMPAIGN_STRATEGY_SYSTEM_PROMPT` already
 * established, narrowed to just the location-resolution concern.
 *
 * `ageMin`/`ageMax` are, same as `PropertyBranchAudienceDefaults.ts`'s own documented caveat,
 * DISPLAY-ONLY once a real campaign sets `specialAdCategories: ['HOUSING']` — Meta itself disables
 * age/gender targeting for HOUSING-category ads. This schema still asks for them (for the same
 * "who this would reach absent HOUSING restrictions" Simulasi-preview framing that file documents),
 * never as a promise they will be sent as real `targeting.age_min`/`age_max`.
 */
export const ResolveLocationLlmPayloadSchema = z.object({
  cities: z.array(z.string().min(1)).min(1).max(6),
  radiusKm: z.number().min(0).max(100),
  ageMin: z.number().int().min(18).max(80),
  ageMax: z.number().int().min(18).max(80),
  reasoning: z.string().min(1),
});
export type ResolveLocationLlmPayload = z.infer<typeof ResolveLocationLlmPayloadSchema>;

export type ResolveLocationResponseDto =
  ({ readonly available: true } & ResolveLocationLlmPayload) | LlmUnavailableResponseDto;
