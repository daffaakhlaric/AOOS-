import { describe, expect, it } from "vitest";

import { BranchId } from "../../src/domain/value-objects/BranchId.js";
import { SalesStatus } from "../../src/domain/value-objects/SalesStatus.js";
import { BranchManagerFactory } from "../../src/factories/BranchManagerFactory.js";
import { makeBranchManagerConfig } from "../fixtures/branchManagerFixtures.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { unwrap } from "../helpers/result.js";

const TENANT = "tenant-dss-motor";

describe("BranchStatus integration", () => {
  it("GetBranchStatus shows team, queue size, today count", async () => {
    const manager = BranchManagerFactory.create({
      config: makeBranchManagerConfig(),
      publisher: createFakePublisher(),
    });
    unwrap(
      manager.addSalesHuman.execute({
        name: "A",
        waNumber: "+628120000001",
        branchId: BranchId.BINTARO,
        maxLeadsPerDay: 1,
      }),
    );
    unwrap(
      manager.addSalesHuman.execute({
        name: "B",
        waNumber: "+628120000002",
        branchId: BranchId.BINTARO,
        status: SalesStatus.OFF,
      }),
    );

    await manager.assignLead.execute({
      leadId: "lead-1",
      branchId: BranchId.BINTARO,
      tenantId: TENANT,
      correlationId: "c1",
    });
    // A is now at quota (maxLeadsPerDay=1) -> next lead queues.
    await manager.assignLead.execute({
      leadId: "lead-2",
      branchId: BranchId.BINTARO,
      tenantId: TENANT,
      correlationId: "c2",
    });

    const status = unwrap(manager.getBranchStatus.execute({ branchId: BranchId.BINTARO }));
    expect(status.team).toHaveLength(2);
    expect(status.availableCount).toBe(0);
    expect(status.queueSize).toBe(1);
    expect(status.todayAssignedCount).toBe(1);
  });

  it("SalesStatusChanged: ON->BUSY triggers a queue check (event published, queue untouched)", async () => {
    const manager = BranchManagerFactory.create({
      config: makeBranchManagerConfig(),
      publisher: createFakePublisher(),
    });
    const a = unwrap(
      manager.addSalesHuman.execute({
        name: "A",
        waNumber: "+628120000001",
        branchId: BranchId.BINTARO,
      }),
    );
    await manager.assignLead.execute({
      leadId: "lead-1",
      branchId: BranchId.BINTARO,
      tenantId: TENANT,
      correlationId: "c1",
    });

    const result = unwrap(
      await manager.updateSalesStatus.execute({
        salesHumanId: a.id,
        status: SalesStatus.BUSY,
        tenantId: TENANT,
        correlationId: "c2",
      }),
    );
    expect(result.status).toBe(SalesStatus.BUSY);

    const status = unwrap(manager.getBranchStatus.execute({ branchId: BranchId.BINTARO }));
    expect(status.availableCount).toBe(0);
  });
});
