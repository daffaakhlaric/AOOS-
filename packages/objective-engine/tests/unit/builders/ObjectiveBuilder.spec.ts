import { describe, expect, it } from "vitest";

import { ObjectiveBuilder } from "../../../src/builders/ObjectiveBuilder.js";
import { ObjectiveId } from "../../../src/domain/value-objects/ObjectiveId.js";
import { ObjectiveStatus } from "../../../src/domain/value-objects/ObjectiveStatus.js";
import { unwrap } from "../../helpers/result.js";

describe("ObjectiveBuilder", () => {
  it("builds a valid default Objective (DRAFT, dss-motor, August 2026)", () => {
    const objective = unwrap(new ObjectiveBuilder().build());
    expect(objective.tenantId).toBe("dss-motor");
    expect(objective.status).toBe(ObjectiveStatus.DRAFT);
    expect(objective.period.monthNumber).toBe(8);
    expect(objective.period.yearNumber).toBe(2026);
    expect(objective.targetHotLeads.toNumber()).toBe(50);
    expect(objective.budgetAllocation.toNumber()).toBe(30_000_000);
    expect(objective.focusUnits.map((f) => f.toString())).toEqual(["Xpander", "Brio"]);
  });

  it("withId overrides the generated id", () => {
    const id = ObjectiveId.generate();
    const objective = unwrap(new ObjectiveBuilder().withId(id).build());
    expect(objective.id).toBe(id);
  });

  it("propagates a build() failure from an invalid override (empty tenantId)", () => {
    const result = new ObjectiveBuilder().withTenantId("").build();
    expect(result.ok).toBe(false);
  });

  it("each with* call returns `this` for chaining", () => {
    const builder = new ObjectiveBuilder();
    expect(builder.withTenantId("x")).toBe(builder);
  });
});
