import "reflect-metadata";

import { BranchId } from "@aos/branch-manager";
import { LeadSource, LeadStatus } from "@aos/lead-store";
import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import type { LeadDetailResponseDto } from "./dto/lead-detail-response.dto.js";
import type { LeadResponseDto } from "./dto/lead-response.dto.js";
import { LeadsController } from "./leads.controller.js";
import type { LeadsService } from "./leads.service.js";

function buildFakeService(): LeadsService {
  return {
    createLead: vi.fn(async () => ({ id: "lead-1", status: "NEW" }) as LeadResponseDto),
    getLeadsByBranch: vi.fn(async () => [{ id: "lead-1", status: "NEW" }] as LeadResponseDto[]),
    getMyLeads: vi.fn(async () => [{ id: "lead-1", status: "ASSIGNED" }] as LeadResponseDto[]),
    getLeadDetail: vi.fn(
      async () => ({ id: "lead-1", status: "HOT", messages: [] }) as LeadDetailResponseDto,
    ),
    claimLead: vi.fn(async () => ({ id: "lead-1", status: "ASSIGNED" }) as LeadResponseDto),
    updateStatus: vi.fn(async () => ({ id: "lead-1", status: "WARM" }) as LeadResponseDto),
  } as unknown as LeadsService;
}

describe("LeadsController", () => {
  it("POST /api/v1/leads delegates to LeadsService.createLead with the body + correlation id", async () => {
    const service = buildFakeService();
    const controller = new LeadsController(service);
    const body = {
      leadSource: LeadSource.CTWA,
      leadPhone: "+6281200000099",
      branchId: BranchId.BINTARO,
      wabaPhoneNumberId: "waba-1",
    };
    const result = await controller.createLead(body, "corr-1");
    expect(service.createLead).toHaveBeenCalledWith(body, "corr-1");
    expect(result).toEqual({ id: "lead-1", status: "NEW" });
  });

  it("GET /api/v1/leads delegates to LeadsService.getLeadsByBranch with the query", async () => {
    const service = buildFakeService();
    const controller = new LeadsController(service);
    const result = await controller.getLeads({ branchId: BranchId.BINTARO });
    expect(service.getLeadsByBranch).toHaveBeenCalledWith({ branchId: BranchId.BINTARO });
    expect(result).toEqual([{ id: "lead-1", status: "NEW" }]);
  });

  it("GET /api/v1/leads/my delegates to LeadsService.getMyLeads with the query", async () => {
    const service = buildFakeService();
    const controller = new LeadsController(service);
    const result = await controller.getMyLeads({ salesHumanId: "sales-1" });
    expect(service.getMyLeads).toHaveBeenCalledWith({ salesHumanId: "sales-1" });
    expect(result).toEqual([{ id: "lead-1", status: "ASSIGNED" }]);
  });

  it("GET /api/v1/leads/:id delegates to LeadsService.getLeadDetail with the id", async () => {
    const service = buildFakeService();
    const controller = new LeadsController(service);
    const result = await controller.getLeadDetail("lead-1");
    expect(service.getLeadDetail).toHaveBeenCalledWith("lead-1");
    expect(result).toEqual({ id: "lead-1", status: "HOT", messages: [] });
  });

  it("POST /api/v1/leads/:id/claim delegates to LeadsService.claimLead with the id + body + correlation id", async () => {
    const service = buildFakeService();
    const controller = new LeadsController(service);
    const result = await controller.claimLead("lead-1", { salesHumanId: "sales-1" }, "corr-2");
    expect(service.claimLead).toHaveBeenCalledWith("lead-1", { salesHumanId: "sales-1" }, "corr-2");
    expect(result).toEqual({ id: "lead-1", status: "ASSIGNED" });
  });

  it("PUT /api/v1/leads/:id/status delegates to LeadsService.updateStatus with the id + body + correlation id", async () => {
    const service = buildFakeService();
    const controller = new LeadsController(service);
    const result = await controller.updateStatus("lead-1", { status: LeadStatus.WARM }, "corr-3");
    expect(service.updateStatus).toHaveBeenCalledWith(
      "lead-1",
      { status: LeadStatus.WARM },
      "corr-3",
    );
    expect(result).toEqual({ id: "lead-1", status: "WARM" });
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", LeadsController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});
