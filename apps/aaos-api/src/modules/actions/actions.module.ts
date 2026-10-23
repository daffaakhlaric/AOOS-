import type { SupabaseClientLike } from "@aos/lead-store";
import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { z } from "zod";

import { TenantId } from "../../common/tenant-context.js";
import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ActivityLogModule } from "../activity-log/activity-log.module.js";
import type { TrustedTenantContext } from "../auth/tenant-authorization.service.js";
import { GrowthPolicyModule } from "../automation-policy/growth-policy.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { ModeGuardModule } from "../mode-guard/mode-guard.module.js";

import { ActionActivityService } from "./action-activity.service.js";
import { ActionApprovalService } from "./action-approval.service.js";
import { ActionEvidenceService } from "./action-evidence.service.js";
import { ActionLearningService } from "./action-learning.service.js";
import { ActionPolicyContext } from "./action-policy-context.js";
import { ActionProposalService } from "./action-proposal.service.js";
import { ActionQueryService } from "./action-query.service.js";
import { ActionRuntimeService } from "./action-runtime.service.js";
import { ActionRepository } from "./action.repository.js";

const approvalBody = z.object({ commandHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();

@Controller("api/v1/actions")
@UseGuards(ApiKeyGuard)
export class ActionsController {
  constructor(
    private readonly queries: ActionQueryService,
    private readonly approvals: ActionApprovalService,
    private readonly runtime: ActionRuntimeService,
  ) {}
  @Get() list(@TenantId() tenant: string) {
    return this.queries.list(tenant);
  }
  @Get(":id") detail(@TenantId() tenant: string, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.queries.detail(tenant, id);
  }
  @Post(":id/approve") approve(
    @Req() request: FastifyRequest & { tenantContext: TrustedTenantContext },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(approvalBody)) body: z.infer<typeof approvalBody>,
  ) {
    return this.approvals.approve(request.tenantContext, id, body.commandHash);
  }
  @Get(":id/preflight") preflight(
    @Req() request: FastifyRequest & { tenantContext: TrustedTenantContext },
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.runtime.preflight(request.tenantContext, id);
  }
  @Post(":id/execute") execute(
    @Req() request: FastifyRequest & { tenantContext: TrustedTenantContext },
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.runtime.execute(request.tenantContext, id);
  }
  @Post(":id/reconcile") reconcile(
    @Req() request: FastifyRequest & { tenantContext: TrustedTenantContext },
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.runtime.reconcile(request.tenantContext, id);
  }
}

/** Runtime writes still require current Phase 3 capabilities, policy and explicit approval. */
@Module({
  imports: [GrowthPolicyModule, ActivityLogModule, ModeGuardModule],
  controllers: [ActionsController],
  providers: [
    ApiKeyGuard,
    ActionQueryService,
    ActionApprovalService,
    ActionPolicyContext,
    ActionRuntimeService,
    ActionProposalService,
    ActionEvidenceService,
    ActionLearningService,
    ActionActivityService,
    {
      provide: ActionRepository,
      useFactory: (db: SupabaseClientLike) => new ActionRepository(db),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [ActionRepository, ActionQueryService, ActionProposalService],
})
export class ActionsModule {}
