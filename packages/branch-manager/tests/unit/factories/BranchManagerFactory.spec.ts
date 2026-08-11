import { describe, expect, it } from "vitest";

import { AssignmentMode } from "../../../src/domain/value-objects/AssignmentMode.js";
import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { BranchManagerFactory } from "../../../src/factories/BranchManagerFactory.js";
import { makeBranchManagerConfig } from "../../fixtures/branchManagerFixtures.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap } from "../../helpers/result.js";

describe("BranchManagerFactory", () => {
  it("seeds all 4 DSS Motor branches with the spec's literal assignment modes/quotas", () => {
    const manager = BranchManagerFactory.create({
      config: makeBranchManagerConfig(),
      publisher: createFakePublisher(),
    });
    const all = manager.branchRegistry.getAll();
    expect(all).toHaveLength(4);

    const bintaro = unwrap(manager.branchRegistry.getByBranchId(BranchId.BINTARO));
    expect(bintaro.assignmentMode).toBe(AssignmentMode.SMART_ASSIGN);
    expect(bintaro.maxLeadsPerSalesPerDay.toNumber()).toBe(10);

    const pondokBambu = unwrap(manager.branchRegistry.getByBranchId(BranchId.UMUM));
    expect(pondokBambu.assignmentMode).toBe(AssignmentMode.ROUND_ROBIN);
    expect(pondokBambu.displayName).toBe("Cabang Pondok Bambu");

    const bandung = unwrap(manager.branchRegistry.getByBranchId(BranchId.BANDUNG));
    expect(bandung.maxLeadsPerSalesPerDay.toNumber()).toBe(8);
  });

  it("wires phoneNumberId values from BranchManagerConfig (not process.env)", () => {
    const manager = BranchManagerFactory.create({
      config: makeBranchManagerConfig({ phoneNumberIdBintaro: "CUSTOM_PHONE_ID" }),
      publisher: createFakePublisher(),
    });
    const bintaro = unwrap(manager.branchRegistry.getByPhoneNumberId("CUSTOM_PHONE_ID"));
    expect(bintaro.id).toBe(BranchId.BINTARO);
  });

  it("produces a fully-wired manager whose AssignLead use case successfully assigns", async () => {
    const manager = BranchManagerFactory.create({
      config: makeBranchManagerConfig(),
      publisher: createFakePublisher(),
    });
    unwrap(
      manager.addSalesHuman.execute({
        name: "Budi",
        waNumber: "+628120000001",
        branchId: BranchId.BINTARO,
      }),
    );

    const result = unwrap(
      await manager.assignLead.execute({
        leadId: "lead-1",
        branchId: BranchId.BINTARO,
        tenantId: "tenant-dss-motor",
        correlationId: "c1",
      }),
    );
    expect(result.status).toBe("ASSIGNED");
  });

  it("accepts caller-supplied logger/tracer/now overrides", () => {
    const now = () => new Date("2026-06-01T00:00:00.000Z");
    const manager = BranchManagerFactory.create({
      config: makeBranchManagerConfig(),
      publisher: createFakePublisher(),
      now,
    });
    expect(manager).toBeDefined();
  });
});
