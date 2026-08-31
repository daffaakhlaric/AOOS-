import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  GetActivitiesQuerySchema,
  toActivityResponseDto,
  type ActivityListResponseDto,
  type GetActivitiesQueryDto,
} from "./dto/activity-log.dto.js";
import { ActivityRepository } from "./infrastructure/activity.repository.js";

/**
 * `GET /api/v1/activity-log` — real, tenant-scoped list backing the dashboard's Activity Log page
 * (design doc Phase B point 4). `x-api-key` auth, same perimeter as every other `aaos-api` module
 * (`ListingsController`'s own doc). This is the historical-list read path; the dashboard's LIVE
 * updates come from its own direct-to-Supabase `postgres_changes` subscription
 * (`021_agent_activities.sql`'s RLS policy), not this endpoint being polled.
 */
@Controller("api/v1/activity-log")
@UseGuards(ApiKeyGuard)
export class ActivityLogController {
  constructor(private readonly activities: ActivityRepository) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(GetActivitiesQuerySchema)) query: GetActivitiesQueryDto,
  ): Promise<ActivityListResponseDto> {
    const rows = await this.activities.list(tenantId, query);
    const activities = rows.map(toActivityResponseDto);
    return { activities, total: activities.length };
  }
}
