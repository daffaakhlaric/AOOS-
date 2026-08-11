import { describe, expect, it } from "vitest";

import { SalesHumanBuilder } from "../../../src/builders/SalesHumanBuilder.js";
import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { SalesHumanId } from "../../../src/domain/value-objects/SalesHumanId.js";
import { SalesStatus } from "../../../src/domain/value-objects/SalesStatus.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("SalesHumanBuilder", () => {
  it("builds with sensible defaults", () => {
    const sales = unwrap(new SalesHumanBuilder().build());
    expect(sales.name).toBe("Budi Santoso");
    expect(sales.branchId).toBe(BranchId.BINTARO);
    expect(sales.status).toBe(SalesStatus.ON);
    expect(sales.maxLeadsPerDay.toNumber()).toBe(10);
    expect(sales.activeLeadCount.toNumber()).toBe(0);
    expect(sales.todayLeadCount.toNumber()).toBe(0);
    expect(sales.lastActiveAt).toBeUndefined();
  });

  it("applies every with-method override", () => {
    const joinedAt = new Date("2025-06-01T00:00:00.000Z");
    const lastActiveAt = new Date("2025-06-02T00:00:00.000Z");
    const sales = unwrap(
      new SalesHumanBuilder()
        .withName("Sari Dewi")
        .withWaNumber("+628130000002")
        .withBranchId(BranchId.CINERE)
        .withStatus(SalesStatus.BUSY)
        .withMaxLeadsPerDay(20)
        .withActiveLeadCount(2)
        .withTodayLeadCount(5)
        .withJoinedAt(joinedAt)
        .withLastActiveAt(lastActiveAt)
        .build(),
    );
    expect(sales.name).toBe("Sari Dewi");
    expect(sales.waNumber).toBe("+628130000002");
    expect(sales.branchId).toBe(BranchId.CINERE);
    expect(sales.status).toBe(SalesStatus.BUSY);
    expect(sales.maxLeadsPerDay.toNumber()).toBe(20);
    expect(sales.activeLeadCount.toNumber()).toBe(2);
    expect(sales.todayLeadCount.toNumber()).toBe(5);
    expect(sales.joinedAt).toBe(joinedAt);
    expect(sales.lastActiveAt).toBe(lastActiveAt);
  });

  it("withId overrides the generated id", () => {
    const id = SalesHumanId.generate();
    const sales = unwrap(new SalesHumanBuilder().withId(id).build());
    expect(sales.id).toBe(id);
  });

  it("propagates an invalid maxLeadsPerDay", () => {
    expect(unwrapErr(new SalesHumanBuilder().withMaxLeadsPerDay(0).build()).message).toContain(
      "MaxLeadsPerDay",
    );
  });

  it("propagates an invalid activeLeadCount", () => {
    expect(unwrapErr(new SalesHumanBuilder().withActiveLeadCount(-1).build()).message).toContain(
      "ActiveLeadCount",
    );
  });

  it("propagates an invalid todayLeadCount", () => {
    expect(unwrapErr(new SalesHumanBuilder().withTodayLeadCount(-1).build()).message).toContain(
      "DailyLeadCount",
    );
  });

  it("propagates a SalesHuman.create validation failure (empty name)", () => {
    expect(unwrapErr(new SalesHumanBuilder().withName("").build()).message).toContain(
      "name must be",
    );
  });
});
