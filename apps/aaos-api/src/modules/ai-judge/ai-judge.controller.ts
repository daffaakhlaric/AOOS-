import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { AiJudgeService, type IngestSimulationBatchResult } from "./ai-judge.service.js";
import {
  IngestSimulationBatchBodySchema,
  type IngestSimulationBatchBodyDto,
} from "./dto/ingest-simulation-batch.dto.js";

/**
 * `api/v1/ai-judge*` — the Self-Learning AI bridge from `apps/aaos-simulator`'s
 * `POST /api/simulate-all` into this app's Self-Improving pipeline. `x-api-key` auth via
 * `ApiKeyGuard`, the SAME convention `apps/aaos-simulator`'s existing `src/lib/aaos-api-client.ts`
 * already uses to call `GET /api/v1/listings/:id` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 8) —
 * no new cross-app auth mechanism invented.
 *
 * Tenant resolution: `@TenantId()`, the SAME `x-tenant-id` header convention every other real
 * cross-app proxy call in this codebase uses (`common/tenant-context.ts`'s own doc). REAL
 * INVESTIGATION FINDING: `apps/aaos-simulator` has zero tenant concept of its own (confirmed —
 * no `tenantId`/`TENANT_ID` reference anywhere in that app) and its own `package.json` describes
 * it as "an internal Next.js tool for DSS Motor" — i.e. genuinely single-tenant today, the exact
 * same real tenant `tenant-context.ts`'s own `DEFAULT_TENANT_ID` ("dss-motor") already resolves
 * to when no header is sent. No new auth/session mechanism was invented for this: when the
 * simulator's own `AAOS_SIMULATOR_TENANT_ID` env var is unset, it sends no `x-tenant-id` header at
 * all, and this decorator's existing default-resolution behavior does the honest right thing —
 * see `apps/aaos-simulator/src/lib/learning-bridge.ts`'s own doc for the full reasoning and the
 * escape hatch for a genuinely multi-tenant future deployment of that tool.
 */
@Controller("api/v1/ai-judge")
@UseGuards(ApiKeyGuard)
export class AiJudgeController {
  constructor(private readonly aiJudgeService: AiJudgeService) {}

  @Post("simulation-batch")
  @HttpCode(201)
  async ingestSimulationBatch(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(IngestSimulationBatchBodySchema))
    body: IngestSimulationBatchBodyDto,
  ): Promise<IngestSimulationBatchResult> {
    return this.aiJudgeService.ingestSimulationBatch(tenantId, body);
  }
}
