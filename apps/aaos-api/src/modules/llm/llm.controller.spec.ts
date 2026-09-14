import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import type { AnalyzeRequestDto, AnalyzeResponseDto } from "./dto/analyze.dto.js";
import type { ChatRequestDto, ChatResponseDto } from "./dto/chat.dto.js";
import type {
  CreativeBriefRequestDto,
  CreativeBriefResponseDto,
} from "./dto/creative-brief.dto.js";
import type {
  PhotoAnalysisRequestDto,
  PhotoAnalysisResponseDto,
} from "./dto/photo-analysis.dto.js";
import { LlmController } from "./llm.controller.js";
import type { LlmService } from "./llm.service.js";

function buildFakeService(): LlmService {
  return {
    analyze: vi.fn(
      async () => ({ available: false, reason: "NO_API_KEY", message: "x" }) as AnalyzeResponseDto,
    ),
    creativeBrief: vi.fn(
      async () =>
        ({ available: false, reason: "NO_API_KEY", message: "x" }) as CreativeBriefResponseDto,
    ),
    chat: vi.fn(async () => ({ available: true, reply: "hi" }) as ChatResponseDto),
    analyzePropertyPhoto: vi.fn(
      async () =>
        ({
          available: true,
          scene: "EKSTERIOR",
          qualityScore: 80,
          marketingScore: 70,
          recommendedUse: "HERO",
          reasoning: "x",
        }) as PhotoAnalysisResponseDto,
    ),
  } as unknown as LlmService;
}

const TENANT_ID = "dss-motor";

describe("LlmController", () => {
  it("POST /api/v1/llm/analyze delegates to LlmService.analyze with the tenantId and body", async () => {
    const service = buildFakeService();
    const controller = new LlmController(service);
    const body: AnalyzeRequestDto = { campaigns: [] };
    const result = await controller.analyze(TENANT_ID, body);
    expect(service.analyze).toHaveBeenCalledWith(TENANT_ID, body);
    expect(result).toEqual({ available: false, reason: "NO_API_KEY", message: "x" });
  });

  it("POST /api/v1/llm/creative-brief delegates to LlmService.creativeBrief with the tenantId and body", async () => {
    const service = buildFakeService();
    const controller = new LlmController(service);
    const body: CreativeBriefRequestDto = { ad: { name: "Xpander" }, branch: "BINTARO" };
    const result = await controller.creativeBrief(TENANT_ID, body);
    expect(service.creativeBrief).toHaveBeenCalledWith(TENANT_ID, body);
    expect(result).toEqual({ available: false, reason: "NO_API_KEY", message: "x" });
  });

  it("POST /api/v1/llm/chat delegates to LlmService.chat with the tenantId and body", async () => {
    const service = buildFakeService();
    const controller = new LlmController(service);
    const body: ChatRequestDto = { messages: [{ role: "user", content: "Halo" }] };
    const result = await controller.chat(TENANT_ID, body);
    expect(service.chat).toHaveBeenCalledWith(TENANT_ID, body);
    expect(result).toEqual({ available: true, reply: "hi" });
  });

  it("POST /api/v1/llm/photo-analysis delegates to LlmService.analyzePropertyPhoto with the tenantId and body", async () => {
    const service = buildFakeService();
    const controller = new LlmController(service);
    const body: PhotoAnalysisRequestDto = { photoUrl: "https://storage.example.com/photo.jpg" };
    const result = await controller.photoAnalysis(TENANT_ID, body);
    expect(service.analyzePropertyPhoto).toHaveBeenCalledWith(TENANT_ID, body);
    expect(result).toEqual({
      available: true,
      scene: "EKSTERIOR",
      qualityScore: 80,
      marketingScore: 70,
      recommendedUse: "HERO",
      reasoning: "x",
    });
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", LlmController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});
