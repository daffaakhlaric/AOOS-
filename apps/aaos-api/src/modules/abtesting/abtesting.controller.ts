import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";

import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { AbTestingService } from "./abtesting.service.js";
import { toAbTestResponseDto, type AbTestResponseDto } from "./dto/ab-test-response.dto.js";
import {
  CreateAbTestBodySchema,
  ListAbTestsQuerySchema,
  type CreateAbTestBodyDto,
  type ListAbTestsQueryDto,
} from "./dto/create-ab-test.dto.js";

/** `/api/v1/abtesting*` — `x-api-key` auth, same discipline as every other write endpoint in this app (AAOS-ABTESTING-LOOKALIKE). Backs `/meta-ads/abtesting`'s tabs + "Buat A/B Test Baru" modal. */
@Controller("api/v1/abtesting")
@UseGuards(ApiKeyGuard)
export class AbTestingController {
  constructor(private readonly service: AbTestingService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(ListAbTestsQuerySchema)) query: ListAbTestsQueryDto,
  ): Promise<readonly AbTestResponseDto[]> {
    const tests = await this.service.listTests(query.status);
    const withVariants = await Promise.all(
      tests.map(async (test) => {
        const { variants } = await this.service.getTest(test.id);
        return toAbTestResponseDto(test, variants);
      }),
    );
    return withVariants;
  }

  @Get(":id")
  async byId(@Param("id") id: string): Promise<AbTestResponseDto> {
    const { test, variants } = await this.service.getTest(id);
    return toAbTestResponseDto(test, variants);
  }

  @Post()
  @HttpCode(201)
  async create(
    @Body(new ZodValidationPipe(CreateAbTestBodySchema)) body: CreateAbTestBodyDto,
  ): Promise<AbTestResponseDto> {
    const test = await this.service.createTest(body);
    const { variants } = await this.service.getTest(test.id);
    return toAbTestResponseDto(test, variants);
  }

  @Post(":id/pause")
  @HttpCode(200)
  async pause(@Param("id") id: string): Promise<AbTestResponseDto> {
    const test = await this.service.pauseTest(id);
    const { variants } = await this.service.getTest(id);
    return toAbTestResponseDto(test, variants);
  }
}
