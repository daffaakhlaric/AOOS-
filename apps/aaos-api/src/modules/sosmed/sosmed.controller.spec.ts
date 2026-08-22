import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import type {
  GenerateCaptionRequestDto,
  GenerateCaptionResponseDto,
} from "../llm/dto/generate-caption.dto.js";
import type {
  GenerateHashtagsRequestDto,
  GenerateHashtagsResponseDto,
} from "../llm/dto/generate-hashtags.dto.js";
import type { LlmService } from "../llm/llm.service.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { SosmedController } from "./sosmed.controller.js";

function buildFakeLlmService(): LlmService {
  return {
    generateCaption: vi.fn(
      async () =>
        ({
          available: true,
          instagramCaption: "IG caption",
          facebookCaption: "FB caption",
        }) as GenerateCaptionResponseDto,
    ),
    generateHashtags: vi.fn(
      async () =>
        ({ available: true, hashtags: ["#A", "#B"] }) as unknown as GenerateHashtagsResponseDto,
    ),
  } as unknown as LlmService;
}

describe("SosmedController", () => {
  it("POST /api/v1/sosmed/generate-caption delegates to LlmService.generateCaption with the body", async () => {
    const llmService = buildFakeLlmService();
    const controller = new SosmedController(llmService);
    const body: GenerateCaptionRequestDto = {
      contentType: "PROMO",
      productRef: "Xpander Cross 2019",
      angle: "DP Ringan",
      tone: "FRIENDLY",
      vertical: "AUTOMOTIVE",
    };
    const result = await controller.generateCaption(body);
    expect(llmService.generateCaption).toHaveBeenCalledWith(body);
    expect(result).toEqual({
      available: true,
      instagramCaption: "IG caption",
      facebookCaption: "FB caption",
    });
  });

  it("POST /api/v1/sosmed/generate-hashtags delegates to LlmService.generateHashtags with the body", async () => {
    const llmService = buildFakeLlmService();
    const controller = new SosmedController(llmService);
    const body: GenerateHashtagsRequestDto = {
      productName: "Xpander Cross 2019",
      brand: "MobixCinere",
      location: "Cinere",
      vertical: "AUTOMOTIVE",
    };
    const result = await controller.generateHashtags(body);
    expect(llmService.generateHashtags).toHaveBeenCalledWith(body);
    expect(result).toEqual({ available: true, hashtags: ["#A", "#B"] });
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", SosmedController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});
