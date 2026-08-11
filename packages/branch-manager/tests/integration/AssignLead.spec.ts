import { describe, expect, it } from "vitest";

import { AssignmentMode } from "../../src/domain/value-objects/AssignmentMode.js";
import { BranchId } from "../../src/domain/value-objects/BranchId.js";
import { SalesStatus } from "../../src/domain/value-objects/SalesStatus.js";
import { BranchManagerFactory } from "../../src/factories/BranchManagerFactory.js";
import { makeBranchManagerConfig } from "../fixtures/branchManagerFixtures.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { unwrap } from "../helpers/result.js";

const TENANT = "tenant-dss-motor";

function buildManager(now?: () => Date) {
  return BranchManagerFactory.create({
    config: makeBranchManagerConfig(),
    publisher: createFakePublisher(),
    now,
  });
}

describe("AssignLead integration", () => {
  it("full cycle: 3 sales ON -> smart assign to least loaded", async () => {
    const manager = buildManager();
    const a = unwrap(
      manager.addSalesHuman.execute({
        name: "A",
        waNumber: "+628120000001",
        branchId: BranchId.BINTARO,
      }),
    );
    const b = unwrap(
      manager.addSalesHuman.execute({
        name: "B",
        waNumber: "+628120000002",
        branchId: BranchId.BINTARO,
      }),
    );
    const c = unwrap(
      manager.addSalesHuman.execute({
        name: "C",
        waNumber: "+628120000003",
        branchId: BranchId.BINTARO,
      }),
    );
    expect(a.status).toBe(SalesStatus.ON);
    expect(b.status).toBe(SalesStatus.ON);
    expect(c.status).toBe(SalesStatus.ON);

    // Give B two prior assignments, so B has the fewest active leads only relatively... instead
    // directly assign 2 leads to load up A and C via repeated smart-assign against a controlled
    // active count using updateSalesStatus is unnecessary here — simplest: assign 5 leads and
    // confirm the least-loaded sales keeps winning (smart_assign core property).
    const assignments = [];
    for (let i = 0; i < 3; i += 1) {
      const result = unwrap(
        await manager.assignLead.execute({
          leadId: `lead-${i}`,
          branchId: BranchId.BINTARO,
          tenantId: TENANT,
          correlationId: `c-${i}`,
        }),
      );
      expect(result.status).toBe("ASSIGNED");
      if (result.status === "ASSIGNED") {
        assignments.push(result.assignment.salesHumanId.toString());
      }
    }
    // With 3 equally-loaded sales and 3 leads, each should get exactly one (round-robin-like
    // outcome from fewest-active-leads-first, since after each assignment the assignee's active
    // count increases past the others).
    expect(new Set(assignments).size).toBe(3);
  });

  it("all sales OFF -> lead queued -> LeadQueued event", async () => {
    const manager = buildManager();
    unwrap(
      manager.addSalesHuman.execute({
        name: "A",
        waNumber: "+628120000001",
        branchId: BranchId.BINTARO,
        status: SalesStatus.OFF,
      }),
    );

    const result = unwrap(
      await manager.assignLead.execute({
        leadId: "lead-1",
        branchId: BranchId.BINTARO,
        tenantId: TENANT,
        correlationId: "c1",
      }),
    );
    expect(result.status).toBe("QUEUED");
    const queued = unwrap(manager.getAssignmentQueue.execute({ branchId: BranchId.BINTARO }));
    expect(queued.map((l) => l.leadId)).toEqual(["lead-1"]);
  });

  it("sales comes ON -> FlushQueue -> queued lead assigned", async () => {
    const manager = buildManager();
    const a = unwrap(
      manager.addSalesHuman.execute({
        name: "A",
        waNumber: "+628120000001",
        branchId: BranchId.BINTARO,
        status: SalesStatus.OFF,
      }),
    );
    unwrap(
      await manager.assignLead.execute({
        leadId: "lead-1",
        branchId: BranchId.BINTARO,
        tenantId: TENANT,
        correlationId: "c1",
      }),
    );
    expect(unwrap(manager.getAssignmentQueue.execute({ branchId: BranchId.BINTARO }))).toHaveLength(
      1,
    );

    unwrap(
      await manager.updateSalesStatus.execute({
        salesHumanId: a.id,
        status: SalesStatus.ON,
        tenantId: TENANT,
        correlationId: "c2",
      }),
    );

    expect(unwrap(manager.getAssignmentQueue.execute({ branchId: BranchId.BINTARO }))).toHaveLength(
      0,
    );
  });

  it("daily quota hit -> next lead goes to queue", async () => {
    const manager = buildManager();
    unwrap(
      manager.addSalesHuman.execute({
        name: "A",
        waNumber: "+628120000001",
        branchId: BranchId.BINTARO,
        maxLeadsPerDay: 1,
      }),
    );

    const first = unwrap(
      await manager.assignLead.execute({
        leadId: "lead-1",
        branchId: BranchId.BINTARO,
        tenantId: TENANT,
        correlationId: "c1",
      }),
    );
    expect(first.status).toBe("ASSIGNED");

    const second = unwrap(
      await manager.assignLead.execute({
        leadId: "lead-2",
        branchId: BranchId.BINTARO,
        tenantId: TENANT,
        correlationId: "c2",
      }),
    );
    expect(second.status).toBe("QUEUED");
  });

  it("ROUND_ROBIN branch (Pondok Bambu / BranchId.UMUM) rotates across assignments", async () => {
    const manager = buildManager();
    const a = unwrap(
      manager.addSalesHuman.execute({
        name: "A",
        waNumber: "+628120000001",
        branchId: BranchId.UMUM,
      }),
    );
    const b = unwrap(
      manager.addSalesHuman.execute({
        name: "B",
        waNumber: "+628120000002",
        branchId: BranchId.UMUM,
      }),
    );

    const first = unwrap(
      await manager.assignLead.execute({
        leadId: "lead-1",
        branchId: BranchId.UMUM,
        tenantId: TENANT,
        correlationId: "c1",
      }),
    );
    const second = unwrap(
      await manager.assignLead.execute({
        leadId: "lead-2",
        branchId: BranchId.UMUM,
        tenantId: TENANT,
        correlationId: "c2",
      }),
    );
    expect(first.status).toBe("ASSIGNED");
    expect(second.status).toBe("ASSIGNED");
    if (first.status === "ASSIGNED" && second.status === "ASSIGNED") {
      const ids = [
        first.assignment.salesHumanId.toString(),
        second.assignment.salesHumanId.toString(),
      ];
      expect(new Set(ids)).toEqual(new Set([a.id.toString(), b.id.toString()]));
    }
    expect(AssignmentMode.ROUND_ROBIN).toBe("ROUND_ROBIN");
  });
});
