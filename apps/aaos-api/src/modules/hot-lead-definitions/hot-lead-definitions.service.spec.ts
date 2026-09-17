import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PutHotLeadDefinitionBodyDto } from "./dto/hot-lead-definition.dto.js";
import { HotLeadDefinitionsService } from "./hot-lead-definitions.service.js";
import type {
  HotLeadDefinitionRepository,
  HotLeadDefinitionRow,
} from "./infrastructure/hot-lead-definition.repository.js";

const TENANT = "propertyklik-demo";

function makeRow(overrides: Partial<HotLeadDefinitionRow> = {}): HotLeadDefinitionRow {
  return {
    id: "def-1",
    tenant_id: TENANT,
    mode: "LEAD_STATUS",
    lead_status_value: "HOT",
    rules: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeRepository(): HotLeadDefinitionRepository {
  return {
    findByTenant: vi.fn(async () => undefined),
    upsert: vi.fn(async () => makeRow()),
  } as unknown as HotLeadDefinitionRepository;
}

describe("HotLeadDefinitionsService", () => {
  let repository: HotLeadDefinitionRepository;
  let service: HotLeadDefinitionsService;

  beforeEach(() => {
    repository = makeRepository();
    service = new HotLeadDefinitionsService(repository);
  });

  it("get() returns undefined when the tenant has not defined anything yet — never a silent default", async () => {
    repository.findByTenant = vi.fn(async () => undefined);
    expect(await service.get(TENANT)).toBeUndefined();
  });

  it("get() returns the mapped DTO when a definition exists", async () => {
    repository.findByTenant = vi.fn(async () => makeRow());
    const dto = await service.get(TENANT);
    expect(dto).toEqual(
      expect.objectContaining({ tenantId: TENANT, mode: "LEAD_STATUS", leadStatusValue: "HOT" }),
    );
  });

  it("set() upserts a LEAD_STATUS definition", async () => {
    const body: PutHotLeadDefinitionBodyDto = { mode: "LEAD_STATUS", leadStatusValue: "HOT" };
    await service.set(TENANT, body);
    expect(repository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        mode: "LEAD_STATUS",
        leadStatusValue: "HOT",
        rules: null,
      }),
    );
  });

  it("set() upserts a RULE_BASED definition", async () => {
    const body: PutHotLeadDefinitionBodyDto = {
      mode: "RULE_BASED",
      rules: [{ field: "score", operator: ">=", value: 65 }],
    };
    repository.upsert = vi.fn(async () =>
      makeRow({ mode: "RULE_BASED", lead_status_value: null, rules: body.rules }),
    );
    const dto = await service.set(TENANT, body);
    expect(repository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        mode: "RULE_BASED",
        leadStatusValue: null,
        rules: body.rules,
      }),
    );
    expect(dto.mode).toBe("RULE_BASED");
  });
});
