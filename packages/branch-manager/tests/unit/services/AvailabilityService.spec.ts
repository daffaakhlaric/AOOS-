import { describe, expect, it } from "vitest";

import { AvailabilityService } from "../../../src/application/services/AvailabilityService.js";
import { BranchManagerEvents } from "../../../src/domain/events/BranchManagerEvents.js";
import { SalesHumanId } from "../../../src/domain/value-objects/SalesHumanId.js";
import { SalesStatus } from "../../../src/domain/value-objects/SalesStatus.js";
import { SalesTeamRegistry } from "../../../src/registry/SalesTeamRegistry.js";
import { fixedClock, makeSalesHuman } from "../../fixtures/branchManagerFixtures.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function setup() {
  const salesTeamRegistry = new SalesTeamRegistry();
  const publisher = createFakePublisher();
  const events = new BranchManagerEvents(publisher);
  const now = fixedClock();
  const service = new AvailabilityService(salesTeamRegistry, events, now);
  return { salesTeamRegistry, publisher, service, now };
}

describe("AvailabilityService", () => {
  it("updateStatus transitions status and publishes SalesStatusChanged", async () => {
    const { salesTeamRegistry, service, publisher } = setup();
    const a = makeSalesHuman({ name: "A", status: SalesStatus.ON });
    salesTeamRegistry.add(a);

    const result = unwrap(
      await service.updateStatus(a.id, SalesStatus.BUSY, { tenantId: "t1", correlationId: "c1" }),
    );
    expect(result.status).toBe(SalesStatus.BUSY);
    expect(unwrap(salesTeamRegistry.getById(a.id)).status).toBe(SalesStatus.BUSY);

    const event = publisher.published.find((p) => p.type === "aaos.branch.sales.status-changed");
    expect(event?.payload).toMatchObject({
      salesHumanId: a.id.toString(),
      previousStatus: SalesStatus.ON,
      newStatus: SalesStatus.BUSY,
    });
  });

  it("ON -> BUSY triggers a queue check (publishes SalesStatusChanged, no assignment side effects here)", async () => {
    const { salesTeamRegistry, service, publisher } = setup();
    const a = makeSalesHuman({ name: "A", status: SalesStatus.ON });
    salesTeamRegistry.add(a);
    await service.updateStatus(a.id, SalesStatus.BUSY, { tenantId: "t1", correlationId: "c1" });
    expect(publisher.published.some((p) => p.type === "aaos.branch.sales.status-changed")).toBe(
      true,
    );
  });

  it("updateStatus fails with SalesHumanNotFoundError for an unregistered id", async () => {
    const { service } = setup();
    const error = unwrapErr(
      await service.updateStatus(SalesHumanId.generate(), SalesStatus.ON, {
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("No sales human registered");
  });

  it("resetDailyCounts resets todayLeadCount to 0 for every registered sales human", () => {
    const { salesTeamRegistry, service } = setup();
    const a = makeSalesHuman({ name: "A", todayLeadCount: 5, activeLeadCount: 2 });
    const b = makeSalesHuman({ name: "B", todayLeadCount: 3 });
    salesTeamRegistry.add(a);
    salesTeamRegistry.add(b);

    service.resetDailyCounts();

    expect(unwrap(salesTeamRegistry.getById(a.id)).todayLeadCount.toNumber()).toBe(0);
    expect(unwrap(salesTeamRegistry.getById(a.id)).activeLeadCount.toNumber()).toBe(2);
    expect(unwrap(salesTeamRegistry.getById(b.id)).todayLeadCount.toNumber()).toBe(0);
  });

  it("resetDailyCounts on an empty registry is a no-op", () => {
    const { service } = setup();
    expect(() => service.resetDailyCounts()).not.toThrow();
  });

  it("defaults to the real wall clock when no now() is injected", async () => {
    const salesTeamRegistry = new SalesTeamRegistry();
    const events = new BranchManagerEvents(createFakePublisher());
    const service = new AvailabilityService(salesTeamRegistry, events);
    const a = makeSalesHuman({ name: "A", status: SalesStatus.ON });
    salesTeamRegistry.add(a);

    const result = unwrap(
      await service.updateStatus(a.id, SalesStatus.OFF, { tenantId: "t1", correlationId: "c1" }),
    );
    expect(result.lastActiveAt).toBeInstanceOf(Date);
  });
});
