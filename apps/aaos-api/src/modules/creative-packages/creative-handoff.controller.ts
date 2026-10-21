import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";

import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CreativeHandoffService } from "./creative-handoff.service.js";
import { SaveCampaignDraftSchema, type SaveCampaignDraft } from "./dto/campaign-draft.dto.js";
import { EnqueueKaiJobsSchema, type EnqueueKaiJobs } from "./dto/kai-generation.dto.js";
import { KaiPlanningService } from "./kai-planning.service.js";

function requireTenant(tenant: string | undefined): string {
  if (!tenant?.trim()) throw new BadRequestException("Tenant context diperlukan.");
  return tenant;
}

/** Server-only handoff API. The dashboard forwards the authenticated workspace, never a form tenant. */
@Controller("api/v1/creative-packages/handoff")
@UseGuards(ApiKeyGuard)
export class CreativeHandoffController {
  constructor(
    private readonly service: CreativeHandoffService,
    private readonly planning: KaiPlanningService,
  ) {}

  @Get("projects/:id/concepts")
  concepts(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.planning.get(requireTenant(tenant), id);
  }

  @Post("projects/:id/concepts")
  generateConcepts(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.planning.generate(requireTenant(tenant), id);
  }

  @Post("projects/:id/jobs")
  enqueueJobs(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(EnqueueKaiJobsSchema)) body: EnqueueKaiJobs,
  ) {
    return this.planning.enqueue(
      requireTenant(tenant),
      id,
      body.conceptIds,
      body.renderMode,
      body.reviewedRevisions,
    );
  }

  @Get("projects/:id/jobs")
  jobs(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.planning.jobs(requireTenant(tenant), id);
  }

  @Post("drafts")
  save(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Body(new ZodValidationPipe(SaveCampaignDraftSchema)) body: SaveCampaignDraft,
  ) {
    return this.service.save(requireTenant(tenant), body);
  }

  @Get("drafts/:id")
  get(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.service.get(requireTenant(tenant), id);
  }

  @Get("projects/:id")
  project(
    @Headers("x-tenant-id") tenant: string | undefined,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.service.project(requireTenant(tenant), id);
  }

  @Get("projects")
  listProjects(@Headers("x-tenant-id") tenant: string | undefined) {
    return this.service.listProjects(requireTenant(tenant));
  }
}
