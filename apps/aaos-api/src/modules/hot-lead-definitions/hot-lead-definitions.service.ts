import { Injectable } from "@nestjs/common";

import {
  toHotLeadDefinitionResponseDto,
  type HotLeadDefinitionResponseDto,
  type PutHotLeadDefinitionBodyDto,
} from "./dto/hot-lead-definition.dto.js";
import { HotLeadDefinitionRepository } from "./infrastructure/hot-lead-definition.repository.js";

/**
 * `modules/hot-lead-definitions` — a tenant-level config, separate from any single Growth
 * Objective: how "Hot Lead" is defined for Growth Objective purposes, reused across every
 * objective a tenant creates.
 */
@Injectable()
export class HotLeadDefinitionsService {
  constructor(private readonly repository: HotLeadDefinitionRepository) {}

  /**
   * Returns the tenant's stored definition, OR `undefined` if the tenant hasn't defined one yet.
   * Per the spec's own instruction: "if tenant doesn't define Hot Lead, UI must ask user to define
   * it" — this method deliberately does NOT default to `LEAD_STATUS = HOT` (or anything else) when
   * nothing is stored. Silently inventing a definition would let a tenant's Growth Objective
   * evaluate against a classifier they never actually chose; returning `undefined` forces the
   * caller (the dashboard) to prompt for one, which is the explicit, correct behavior here.
   */
  async get(tenantId: string): Promise<HotLeadDefinitionResponseDto | undefined> {
    const row = await this.repository.findByTenant(tenantId);
    return row === undefined ? undefined : toHotLeadDefinitionResponseDto(row);
  }

  async set(
    tenantId: string,
    dto: PutHotLeadDefinitionBodyDto,
  ): Promise<HotLeadDefinitionResponseDto> {
    const row = await this.repository.upsert({
      tenantId,
      mode: dto.mode,
      leadStatusValue: dto.leadStatusValue ?? null,
      rules: dto.rules ?? null,
      updatedAt: new Date().toISOString(),
    });
    return toHotLeadDefinitionResponseDto(row);
  }
}
