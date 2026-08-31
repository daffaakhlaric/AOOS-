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

import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  CreateCalendarEventBodySchema,
  GetCalendarQuerySchema,
  UpdateCalendarEventBodySchema,
  toCalendarEventResponseDto,
  type CalendarEventResponseDto,
  type CreateCalendarEventBodyDto,
  type GetCalendarQueryDto,
  type UpdateCalendarEventBodyDto,
} from "./dto/calendar-event.dto.js";
import { SchedulerService } from "./scheduler.service.js";

/**
 * `GET/POST/PUT/DELETE /api/v1/calendar*` — `x-api-key` auth, same discipline as every other
 * write endpoint in this app. Backs the "Kalender Aktivitas" widget embedded in the real Overview
 * page (`apps/aaos-dashboard`'s `DashboardClient.tsx`) — see coordinator note section 2 for why
 * there is no separate `/calendar` page.
 */
@Controller("api/v1/calendar")
@UseGuards(ApiKeyGuard)
export class SchedulerController {
  constructor(private readonly service: SchedulerService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(GetCalendarQuerySchema)) query: GetCalendarQueryDto,
  ): Promise<readonly CalendarEventResponseDto[]> {
    const events = await this.service.listEvents(tenantId, query);
    return events.map(toCalendarEventResponseDto);
  }

  @Post()
  @HttpCode(201)
  async create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(CreateCalendarEventBodySchema)) body: CreateCalendarEventBodyDto,
  ): Promise<CalendarEventResponseDto> {
    const created = await this.service.createEvent(tenantId, body);
    return toCalendarEventResponseDto(created);
  }

  @Put(":id")
  async update(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateCalendarEventBodySchema)) body: UpdateCalendarEventBodyDto,
  ): Promise<CalendarEventResponseDto> {
    const updated = await this.service.updateEvent(tenantId, id, body);
    return toCalendarEventResponseDto(updated);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@TenantId() tenantId: string, @Param("id") id: string): Promise<void> {
    // Not explicitly named in the coordinator note's point 1 endpoint list, but `removeEvent`
    // (point 2) requires a real `tenantId` ownership check just like every other id-addressed
    // method here — mirrored for consistency, not left as the one unguarded mutation.
    await this.service.removeEvent(tenantId, id);
  }

  @Post(":id/run-now")
  @HttpCode(200)
  async runNow(
    @TenantId() tenantId: string,
    @Param("id") id: string,
  ): Promise<CalendarEventResponseDto> {
    const event = await this.service.runNow(tenantId, id);
    return toCalendarEventResponseDto(event);
  }

  @Post(":id/skip")
  @HttpCode(200)
  async skip(
    @TenantId() tenantId: string,
    @Param("id") id: string,
  ): Promise<CalendarEventResponseDto> {
    const event = await this.service.skip(tenantId, id);
    return toCalendarEventResponseDto(event);
  }
}
