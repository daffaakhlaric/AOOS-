import { PROPERTY_BRANCH_AUDIENCE_DEFAULTS } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import type { LlmService } from "../llm/llm.service.js";

import {
  LocationResolverService,
  type LocationResolverInput,
} from "./location-resolver.service.js";

function buildFakeLlmService(overrides: Partial<LlmService> = {}): LlmService {
  return {
    resolveLocation: vi.fn(),
    ...overrides,
  } as unknown as LlmService;
}

const TENANT_ID = "dss-motor";

const BASE_INPUT: LocationResolverInput = {
  listingTitle: "Rumah Minimalis 2 Lantai Bintaro",
  propertyType: "RUMAH",
  price: 1_500_000_000,
  branchId: "BINTARO",
};

describe("LocationResolverService.resolve", () => {
  it("LLM success path returns the real resolved locations with source LLM", async () => {
    const llmService = buildFakeLlmService({
      resolveLocation: vi.fn(async () => ({
        available: true,
        cities: ["Tangerang Selatan", "Jakarta Selatan"],
        radiusKm: 20,
        ageMin: 28,
        ageMax: 50,
        reasoning: "Dekat lokasi listing, radius disesuaikan harga menengah.",
      })),
    });
    const service = new LocationResolverService(llmService);

    const result = await service.resolve(TENANT_ID, BASE_INPUT);

    expect(llmService.resolveLocation).toHaveBeenCalledWith(TENANT_ID, {
      listingTitle: BASE_INPUT.listingTitle,
      propertyType: BASE_INPUT.propertyType,
      price: BASE_INPUT.price,
      branchId: BASE_INPUT.branchId,
    });
    expect(result).toEqual({
      cities: ["Tangerang Selatan", "Jakarta Selatan"],
      radiusKm: 20,
      ageMin: 28,
      ageMax: 50,
      source: "LLM",
      reasoning: "Dekat lokasi listing, radius disesuaikan harga menengah.",
    });
  });

  it("LLM failure/degrade path falls back to propertyBranchAudienceDefault, matching the real table's exact values for a known branch", async () => {
    const llmService = buildFakeLlmService({
      resolveLocation: vi.fn(async () => ({
        available: false,
        reason: "PROVIDER_ERROR" as const,
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      })),
    });
    const service = new LocationResolverService(llmService);

    const result = await service.resolve(TENANT_ID, BASE_INPUT);

    const expected = PROPERTY_BRANCH_AUDIENCE_DEFAULTS["BINTARO"]!;
    expect(result.source).toBe("FALLBACK");
    expect(result.cities).toEqual(expected.cities);
    expect(result.radiusKm).toBe(expected.radiusKm);
    expect(result.ageMin).toBe(expected.ageMin);
    expect(result.ageMax).toBe(expected.ageMax);
    expect(result.reasoning).toContain("PROVIDER_ERROR");
    expect(result.reasoning).toContain(expected.note);
  });

  it("falls back to the real UMUM (nationwide) default when branchId is unrecognized", async () => {
    const llmService = buildFakeLlmService({
      resolveLocation: vi.fn(async () => ({
        available: false,
        reason: "NO_API_KEY" as const,
        message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
      })),
    });
    const service = new LocationResolverService(llmService);

    const result = await service.resolve(TENANT_ID, {
      ...BASE_INPUT,
      branchId: "SOMEWHERE_UNKNOWN",
    });

    const expected = PROPERTY_BRANCH_AUDIENCE_DEFAULTS["UMUM"]!;
    expect(result.source).toBe("FALLBACK");
    expect(result.cities).toEqual(expected.cities);
    expect(result.radiusKm).toBe(expected.radiusKm);
    expect(result.ageMin).toBe(expected.ageMin);
    expect(result.ageMax).toBe(expected.ageMax);
  });

  it("falls back to the real UMUM default when branchId is omitted entirely", async () => {
    const llmService = buildFakeLlmService({
      resolveLocation: vi.fn(async () => ({
        available: false,
        reason: "RATE_LIMITED" as const,
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      })),
    });
    const service = new LocationResolverService(llmService);

    const { branchId: _branchId, ...withoutBranch } = BASE_INPUT;
    const result = await service.resolve(TENANT_ID, withoutBranch);

    const expected = PROPERTY_BRANCH_AUDIENCE_DEFAULTS["UMUM"]!;
    expect(result.cities).toEqual(expected.cities);
    expect(result.radiusKm).toBe(expected.radiusKm);
  });
});
