import { describe, expect, it } from "vitest";

import { ObjectiveId } from "../../../src/domain/value-objects/ObjectiveId.js";
import { ObjectiveStatus } from "../../../src/domain/value-objects/ObjectiveStatus.js";
import { ObjectiveFactory } from "../../../src/factories/ObjectiveFactory.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function validInput() {
  return {
    id: ObjectiveId.generate(),
    tenantId: "dss-motor",
    period: { month: 8, year: 2026 },
    targetHotLeads: 50,
    budgetAllocation: 30_000_000,
    focusUnits: ["Xpander", "Brio"],
    areaPriorities: ["CINERE"],
    status: ObjectiveStatus.DRAFT,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
  };
}

describe("ObjectiveFactory", () => {
  it("creates a valid Objective from primitives", () => {
    const objective = unwrap(ObjectiveFactory.create(validInput()));
    expect(objective.tenantId).toBe("dss-motor");
    expect(objective.targetHotLeads.toNumber()).toBe(50);
    expect(objective.focusUnits.map((f) => f.toString())).toEqual(["Xpander", "Brio"]);
    expect(objective.areaPriorities.map((a) => a.toBranch())).toEqual(["CINERE"]);
  });

  it("propagates optional activatedAt/completedAt", () => {
    const activatedAt = new Date("2026-08-02T00:00:00.000Z");
    const completedAt = new Date("2026-08-20T00:00:00.000Z");
    const objective = unwrap(
      ObjectiveFactory.create({ ...validInput(), activatedAt, completedAt }),
    );
    expect(objective.activatedAt).toBe(activatedAt);
    expect(objective.completedAt).toBe(completedAt);
  });

  it("rejects an invalid period", () => {
    const error = unwrapErr(
      ObjectiveFactory.create({ ...validInput(), period: { month: 13, year: 2026 } }),
    );
    expect(error.message).toContain("month");
  });

  it("rejects an invalid targetHotLeads", () => {
    expect(ObjectiveFactory.create({ ...validInput(), targetHotLeads: 0 }).ok).toBe(false);
  });

  it("rejects an invalid budgetAllocation", () => {
    expect(ObjectiveFactory.create({ ...validInput(), budgetAllocation: -1 }).ok).toBe(false);
  });

  it("rejects an invalid focusUnits entry", () => {
    expect(ObjectiveFactory.create({ ...validInput(), focusUnits: ["Bogus"] }).ok).toBe(false);
  });

  it("rejects an invalid areaPriorities entry", () => {
    expect(ObjectiveFactory.create({ ...validInput(), areaPriorities: ["Bogus"] }).ok).toBe(false);
  });

  it("rejects when the underlying Objective.create rejects (empty tenantId)", () => {
    expect(ObjectiveFactory.create({ ...validInput(), tenantId: "" }).ok).toBe(false);
  });
});
