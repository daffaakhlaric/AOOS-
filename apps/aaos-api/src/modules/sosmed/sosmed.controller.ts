import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";

import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import {
  GenerateCaptionRequestSchema,
  type GenerateCaptionRequestDto,
  type GenerateCaptionResponseDto,
} from "../llm/dto/generate-caption.dto.js";
import {
  GenerateHashtagsRequestSchema,
  type GenerateHashtagsRequestDto,
  type GenerateHashtagsResponseDto,
} from "../llm/dto/generate-hashtags.dto.js";
import { LlmService } from "../llm/llm.service.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { SosmedPostsService } from "./application/sosmed-posts.service.js";
import type { StoredScheduledPost } from "./domain/scheduled-post.js";
import {
  CreateScheduledPostBodySchema,
  ListScheduledPostsQuerySchema,
  PublishNowBodySchema,
  UpdateScheduledPostBodySchema,
  type CreateScheduledPostBodyDto,
  type ListScheduledPostsQueryDto,
  type PublishNowBodyDto,
  type UpdateScheduledPostBodyDto,
} from "./dto/scheduled-post.dto.js";

/**
 * `/api/v1/sosmed/*` (AAOS-SOSMED-AUTOMATION). `x-api-key`-guarded via the same shared
 * `ApiKeyGuard` every other write-capable endpoint in this app uses.
 *
 * Phase 1: `generate-caption`/`generate-hashtags`, delegated straight to `LlmService`.
 * Phase 3: real `scheduled_posts` CRUD + `publish-now`, delegated to `SosmedPostsService`. Every
 * other checklist endpoint (`accounts/*`, `weekly-plan`, `analytics`, `best-times/*`) remains a
 * later phase, per the coordinator note's risk-ordered build plan.
 */
@Controller("api/v1/sosmed")
@UseGuards(ApiKeyGuard)
export class SosmedController {
  constructor(
    private readonly llmService: LlmService,
    private readonly postsService: SosmedPostsService,
  ) {}

  @Post("generate-caption")
  @HttpCode(200)
  async generateCaption(
    @Body(new ZodValidationPipe(GenerateCaptionRequestSchema)) body: GenerateCaptionRequestDto,
  ): Promise<GenerateCaptionResponseDto> {
    return this.llmService.generateCaption(body);
  }

  @Post("generate-hashtags")
  @HttpCode(200)
  async generateHashtags(
    @Body(new ZodValidationPipe(GenerateHashtagsRequestSchema)) body: GenerateHashtagsRequestDto,
  ): Promise<GenerateHashtagsResponseDto> {
    return this.llmService.generateHashtags(body);
  }

  @Get("posts")
  async listPosts(
    @Query(new ZodValidationPipe(ListScheduledPostsQuerySchema)) query: ListScheduledPostsQueryDto,
  ): Promise<readonly StoredScheduledPost[]> {
    return this.postsService.listPosts(query.status);
  }

  @Get("posts/:id")
  async getPost(@Param("id") id: string): Promise<StoredScheduledPost> {
    return this.postsService.getPost(id);
  }

  @Post("posts")
  @HttpCode(201)
  async createPost(
    @Body(new ZodValidationPipe(CreateScheduledPostBodySchema)) body: CreateScheduledPostBodyDto,
  ): Promise<StoredScheduledPost> {
    return this.postsService.createPost(body);
  }

  @Put("posts/:id")
  async updatePost(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateScheduledPostBodySchema)) body: UpdateScheduledPostBodyDto,
  ): Promise<StoredScheduledPost> {
    return this.postsService.updatePost(id, body);
  }

  @Delete("posts/:id")
  @HttpCode(204)
  async deletePost(@Param("id") id: string): Promise<void> {
    await this.postsService.deletePost(id);
  }

  @Post("posts/:id/publish-now")
  @HttpCode(200)
  async publishNow(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(PublishNowBodySchema)) body: PublishNowBodyDto,
  ): Promise<StoredScheduledPost> {
    return this.postsService.publishNow(id, body);
  }
}
