import { describe, expect, it } from "vitest";

import { ObjectiveBuilder } from "../../../../src/builders/ObjectiveBuilder.js";
import { Objective } from "../../../../src/domain/entities/Objective.js";
import { AreaPriority } from "../../../../src/domain/value-objects/AreaPriority.js";
import { BudgetAllocation } from "../../../../src/domain/value-objects/BudgetAllocation.js";
import { FocusUnit } from "../../../../src/domain/value-objects/FocusUnit.js";
import { ObjectiveId } from "../../../../src/domain/value-objects/ObjectiveId.js";
import { ObjectivePeriod } from "../../../../src/domain/value-objects/ObjectivePeriod.js";
import { ObjectiveStatus } from "../../../../src/domain/value-objects/ObjectiveStatus.js";
import { TargetLeads } from "../../../../src/domain/value-objects/TargetLeads.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

function validProps() {
  return {
    id: ObjectiveId.generate(),
    tenantId: "dss-motor",
    period: unwrap(ObjectivePeriod.create({ month: 8, year: 2026 })),
    targetHotLeads: unwrap(TargetLeads.create(50)),
    budgetAllocation: unwrap(BudgetAllocation.create(30_000_000)),
    focusUnits: [unwrap(FocusUnit.create("Xpander"))],
    areaPriorities: [unwrap(AreaPriority.create("CINERE"))],
    status: ObjectiveStatus.DRAFT,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
  };
}

describe("Objective", () => {
  it("creates a valid Objective", () => {
    const objective = unwrap(Objective.create(validProps()));
    expect(objective.tenantId).toBe("dss-motor");
    expect(objective.targetHotLeads.toNumber()).toBe(50);
    expect(objective.status).toBe(ObjectiveStatus.DRAFT);
    expect(objective.activatedAt).toBeUndefined();
    expect(objective.completedAt).toBeUndefined();
  });

  it("rejects an empty tenantId", () => {
    expect(Objective.create({ ...validProps(), tenantId: "" }).ok).toBe(false);
  });

  it("rejects an empty focusUnits array", () => {
    expect(Objective.create({ ...validProps(), focusUnits: [] }).ok).toBe(false);
  });

  it("rejects an empty areaPriorities array", () => {
    expect(Objective.create({ ...validProps(), areaPriorities: [] }).ok).toBe(false);
  });

  it("rejects an invalid status", () => {
    expect(Objective.create({ ...validProps(), status: "BOGUS" as never }).ok).toBe(false);
  });

  it("activate() returns a new ACTIVE Objective with activatedAt stamped", () => {
    const objective = unwrap(Objective.create(validProps()));
    const activatedAt = new Date("2026-08-02T00:00:00.000Z");
    const activated = objective.activate(activatedAt);
    expect(activated.status).toBe(ObjectiveStatus.ACTIVE);
    expect(activated.activatedAt).toBe(activatedAt);
    expect(objective.status).toBe(ObjectiveStatus.DRAFT); // original unchanged
  });

  it("complete() returns a new COMPLETED Objective with completedAt stamped", () => {
    const objective = unwrap(Objective.create(validProps()));
    const completedAt = new Date("2026-08-20T00:00:00.000Z");
    const completed = objective.complete(completedAt);
    expect(completed.status).toBe(ObjectiveStatus.COMPLETED);
    expect(completed.completedAt).toBe(completedAt);
  });

  it("cancel() returns a new CANCELLED Objective", () => {
    const objective = unwrap(Objective.create(validProps()));
    expect(objective.cancel().status).toBe(ObjectiveStatus.CANCELLED);
  });

  it("withUpdates() replaces only the given fields", () => {
    const objective = unwrap(Objective.create(validProps()));
    const newTarget = unwrap(TargetLeads.create(80));
    const updated = objective.withUpdates({ targetHotLeads: newTarget });
    expect(updated.targetHotLeads.toNumber()).toBe(80);
    expect(updated.budgetAllocation.equals(objective.budgetAllocation)).toBe(true);
  });

  it("withUpdates() replaces focusUnits/areaPriorities arrays when given", () => {
    const objective = unwrap(Objective.create(validProps()));
    const newFocusUnits = [unwrap(FocusUnit.create("Brio"))];
    const newAreas = [unwrap(AreaPriority.create("BINTARO"))];
    const updated = objective.withUpdates({
      focusUnits: newFocusUnits,
      areaPriorities: newAreas,
    });
    expect(updated.focusUnits.map((f) => f.toString())).toEqual(["Brio"]);
    expect(updated.areaPriorities.map((a) => a.toBranch())).toEqual(["BINTARO"]);
  });

  it("withUpdates() keeps existing focusUnits/areaPriorities when not given", () => {
    const objective = unwrap(Objective.create(validProps()));
    const updated = objective.withUpdates({});
    expect(updated.focusUnits.length).toBe(objective.focusUnits.length);
    expect(updated.areaPriorities.length).toBe(objective.areaPriorities.length);
  });

  it("getters expose every constructed field", () => {
    const props = validProps();
    const objective = unwrap(Objective.create(props));
    expect(objective.id).toBe(props.id);
    expect(objective.period).toBe(props.period);
    expect(objective.budgetAllocation).toBe(props.budgetAllocation);
    expect(objective.focusUnits.length).toBe(1);
    expect(objective.areaPriorities.length).toBe(1);
    expect(objective.createdAt).toBe(props.createdAt);
  });

  it("ObjectiveBuilder builds a valid default Objective", () => {
    const objective = unwrap(new ObjectiveBuilder().build());
    expect(objective.tenantId).toBe("dss-motor");
  });

  it("ObjectiveBuilder supports every with* method", () => {
    const id = ObjectiveId.generate();
    const period = unwrap(ObjectivePeriod.create({ month: 9, year: 2026 }));
    const target = unwrap(TargetLeads.create(100));
    const budget = unwrap(BudgetAllocation.create(50_000_000));
    const focusUnits = [unwrap(FocusUnit.create("Avanza"))];
    const areaPriorities = [unwrap(AreaPriority.create("BANDUNG"))];
    const createdAt = new Date("2026-09-01T00:00:00.000Z");
    const activatedAt = new Date("2026-09-02T00:00:00.000Z");
    const completedAt = new Date("2026-09-28T00:00:00.000Z");

    const objective = unwrap(
      new ObjectiveBuilder()
        .withId(id)
        .withTenantId("other-tenant")
        .withPeriod(period)
        .withTargetHotLeads(target)
        .withBudgetAllocation(budget)
        .withFocusUnits(focusUnits)
        .withAreaPriorities(areaPriorities)
        .withStatus(ObjectiveStatus.COMPLETED)
        .withCreatedAt(createdAt)
        .withActivatedAt(activatedAt)
        .withCompletedAt(completedAt)
        .build(),
    );

    expect(objective.id).toBe(id);
    expect(objective.tenantId).toBe("other-tenant");
    expect(objective.period).toBe(period);
    expect(objective.targetHotLeads).toBe(target);
    expect(objective.budgetAllocation).toBe(budget);
    expect(objective.status).toBe(ObjectiveStatus.COMPLETED);
    expect(objective.createdAt).toBe(createdAt);
    expect(objective.activatedAt).toBe(activatedAt);
    expect(objective.completedAt).toBe(completedAt);
  });

  it("Objective.create() error carries a message", () => {
    const error = unwrapErr(Objective.create({ ...validProps(), tenantId: "" }));
    expect(error.message).toContain("tenantId");
  });
});
