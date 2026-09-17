import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import type { HotLeadDefinitionResponseDto } from "./dto/hot-lead-definition.dto.js";
import { HotLeadDefinitionsController } from "./hot-lead-definitions.controller.js";
import type { HotLeadDefinitionsService } from "./hot-lead-definitions.service.js";

const TENANT = "propertyklik-demo";

const DEFINITION_SAMPLE: HotLeadDefinitionResponseDto = {
  tenantId: TENANT,
  mode: "LEAD_STATUS",
  leadStatusValue: "HOT",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function buildFakeService(): HotLeadDefinitionsService {
  return {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => DEFINITION_SAMPLE),
  } as unknown as HotLeadDefinitionsService;
}

describe("HotLeadDefinitionsController", () => {
  it("get() returns null (HTTP 200, not 404) when the tenant has no stored definition", async () => {
    const service = buildFakeService();
    const controller = new HotLeadDefinitionsController(service);
    const result = await controller.get(TENANT);
    expect(service.get).toHaveBeenCalledWith(TENANT);
    expect(result).toBeNull();
  });

  it("get() returns the definition when one exists", async () => {
    const service = buildFakeService();
    service.get = vi.fn(async () => DEFINITION_SAMPLE);
    const controller = new HotLeadDefinitionsController(service);
    const result = await controller.get(TENANT);
    expect(result).toEqual(DEFINITION_SAMPLE);
  });

  it("set() delegates to the service with the tenant id + validated body", async () => {
    const service = buildFakeService();
    const controller = new HotLeadDefinitionsController(service);
    const body = { mode: "LEAD_STATUS" as const, leadStatusValue: "HOT" as const };
    const result = await controller.set(TENANT, body);
    expect(service.set).toHaveBeenCalledWith(TENANT, body);
    expect(result).toEqual(DEFINITION_SAMPLE);
  });
});
