import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import type { AnalyzeRequestDto, AnalyzeResponseDto } from "./dto/analyze.dto.js";
import type { ChatRequestDto, ChatResponseDto } from "./dto/chat.dto.js";
import type {
  CreativeBriefRequestDto,
  CreativeBriefResponseDto,
} from "./dto/creative-brief.dto.js";
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
  } as unknown as LlmService;
}

describe("LlmController", () => {
  it("POST /api/v1/llm/analyze delegates to LlmService.analyze with the body", async () => {
    const service = buildFakeService();
    const controller = new LlmController(service);
    const body: AnalyzeRequestDto = { campaigns: [] };
    const result = await controller.analyze(body);
    expect(service.analyze).toHaveBeenCalledWith(body);
    expect(result).toEqual({ available: false, reason: "NO_API_KEY", message: "x" });
  });

  it("POST /api/v1/llm/creative-brief delegates to LlmService.creativeBrief with the body", async () => {
    const service = buildFakeService();
    const controller = new LlmController(service);
    const body: CreativeBriefRequestDto = { ad: { name: "Xpander" }, branch: "BINTARO" };
    const result = await controller.creativeBrief(body);
    expect(service.creativeBrief).toHaveBeenCalledWith(body);
    expect(result).toEqual({ available: false, reason: "NO_API_KEY", message: "x" });
  });

  it("POST /api/v1/llm/chat delegates to LlmService.chat with the body", async () => {
    const service = buildFakeService();
    const controller = new LlmController(service);
    const body: ChatRequestDto = { messages: [{ role: "user", content: "Halo" }] };
    const result = await controller.chat(body);
    expect(service.chat).toHaveBeenCalledWith(body);
    expect(result).toEqual({ available: true, reply: "hi" });
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", LlmController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});
