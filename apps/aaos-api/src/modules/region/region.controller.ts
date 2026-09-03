import { Controller, Get, Param, UseGuards } from "@nestjs/common";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import type { RegionListResponseDto } from "./dto/region.dto.js";
import { RegionService } from "./region.service.js";

/**
 * `GET /api/v1/region/provinces`, `GET /api/v1/region/regencies/:provinceId`,
 * `GET /api/v1/region/districts/:regencyId` — real, thin proxy over the public wilayah catalog
 * (`RegionService`'s class doc). `x-api-key` auth, same perimeter as every other `aaos-api`
 * module, but NOT tenant-scoped (no `@TenantId()`) — this is public reference data, not tenant
 * data.
 */
@Controller("api/v1/region")
@UseGuards(ApiKeyGuard)
export class RegionController {
  constructor(private readonly service: RegionService) {}

  @Get("provinces")
  async provinces(): Promise<RegionListResponseDto> {
    return { items: await this.service.getProvinces() };
  }

  @Get("regencies/:provinceId")
  async regencies(@Param("provinceId") provinceId: string): Promise<RegionListResponseDto> {
    return { items: await this.service.getRegencies(provinceId) };
  }

  @Get("districts/:regencyId")
  async districts(@Param("regencyId") regencyId: string): Promise<RegionListResponseDto> {
    return { items: await this.service.getDistricts(regencyId) };
  }
}
