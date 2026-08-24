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

import type { SosmedPostsService } from "./application/sosmed-posts.service.js";
import type { StoredScheduledPost } from "./domain/scheduled-post.js";
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

const FAKE_POST: StoredScheduledPost = {
  id: "post-1",
  tenantId: "dss-motor",
  caption: "Xpander Cross DP 29jt",
  hashtags: [],
  generatedBy: "TAMARA",
  status: "DRAFT",
  reach: 0,
  impressions: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  engagementCount: 0,
  createdAt: "2026-08-25T00:00:00.000Z",
};

function buildFakePostsService(): SosmedPostsService {
  return {
    listPosts: vi.fn(async () => [FAKE_POST]),
    getPost: vi.fn(async () => FAKE_POST),
    createPost: vi.fn(async () => FAKE_POST),
    updatePost: vi.fn(async () => ({ ...FAKE_POST, caption: "Updated" })),
    deletePost: vi.fn(async () => undefined),
    publishNow: vi.fn(async () => ({ ...FAKE_POST, status: "PUBLISHED" as const })),
  } as unknown as SosmedPostsService;
}

describe("SosmedController", () => {
  it("POST /api/v1/sosmed/generate-caption delegates to LlmService.generateCaption with the body", async () => {
    const llmService = buildFakeLlmService();
    const controller = new SosmedController(llmService, buildFakePostsService());
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
    const controller = new SosmedController(llmService, buildFakePostsService());
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

  it("GET /api/v1/sosmed/posts delegates to SosmedPostsService.listPosts with the status filter", async () => {
    const postsService = buildFakePostsService();
    const controller = new SosmedController(buildFakeLlmService(), postsService);
    const result = await controller.listPosts({ status: "DRAFT" });
    expect(postsService.listPosts).toHaveBeenCalledWith("DRAFT");
    expect(result).toEqual([FAKE_POST]);
  });

  it("GET /api/v1/sosmed/posts/:id delegates to SosmedPostsService.getPost", async () => {
    const postsService = buildFakePostsService();
    const controller = new SosmedController(buildFakeLlmService(), postsService);
    const result = await controller.getPost("post-1");
    expect(postsService.getPost).toHaveBeenCalledWith("post-1");
    expect(result).toEqual(FAKE_POST);
  });

  it("POST /api/v1/sosmed/posts delegates to SosmedPostsService.createPost with the body", async () => {
    const postsService = buildFakePostsService();
    const controller = new SosmedController(buildFakeLlmService(), postsService);
    const body = { caption: "Promo weekend", status: "DRAFT" as const };
    const result = await controller.createPost(body);
    expect(postsService.createPost).toHaveBeenCalledWith(body);
    expect(result).toEqual(FAKE_POST);
  });

  it("PUT /api/v1/sosmed/posts/:id delegates to SosmedPostsService.updatePost", async () => {
    const postsService = buildFakePostsService();
    const controller = new SosmedController(buildFakeLlmService(), postsService);
    const body = { caption: "Updated" };
    const result = await controller.updatePost("post-1", body);
    expect(postsService.updatePost).toHaveBeenCalledWith("post-1", body);
    expect(result.caption).toBe("Updated");
  });

  it("DELETE /api/v1/sosmed/posts/:id delegates to SosmedPostsService.deletePost", async () => {
    const postsService = buildFakePostsService();
    const controller = new SosmedController(buildFakeLlmService(), postsService);
    await controller.deletePost("post-1");
    expect(postsService.deletePost).toHaveBeenCalledWith("post-1");
  });

  it("POST /api/v1/sosmed/posts/:id/publish-now delegates to SosmedPostsService.publishNow with id + body", async () => {
    const postsService = buildFakePostsService();
    const controller = new SosmedController(buildFakeLlmService(), postsService);
    const body = { platform: "FACEBOOK" as const, pageId: "123", accessToken: "fresh-token" };
    const result = await controller.publishNow("post-1", body);
    expect(postsService.publishNow).toHaveBeenCalledWith("post-1", body);
    expect(result.status).toBe("PUBLISHED");
  });
});
