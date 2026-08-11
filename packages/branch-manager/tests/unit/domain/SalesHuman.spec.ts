import { describe, expect, it } from "vitest";

import { SalesHuman } from "../../../src/domain/entities/SalesHuman.js";
import { ActiveLeadCount } from "../../../src/domain/value-objects/ActiveLeadCount.js";
import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { DailyLeadCount } from "../../../src/domain/value-objects/DailyLeadCount.js";
import { MaxLeadsPerDay } from "../../../src/domain/value-objects/MaxLeadsPerDay.js";
import { SalesHumanId } from "../../../src/domain/value-objects/SalesHumanId.js";
import { SalesStatus } from "../../../src/domain/value-objects/SalesStatus.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const JOINED_AT = new Date("2026-01-01T00:00:00.000Z");

function validProps(overrides: Partial<Parameters<typeof SalesHuman.create>[0]> = {}) {
  return {
    id: SalesHumanId.generate(),
    name: "Budi Santoso",
    waNumber: "+628120000001",
    branchId: BranchId.BINTARO,
    status: SalesStatus.ON,
    maxLeadsPerDay: unwrap(MaxLeadsPerDay.create(10)),
    activeLeadCount: ActiveLeadCount.zero(),
    todayLeadCount: DailyLeadCount.zero(),
    joinedAt: JOINED_AT,
    ...overrides,
  };
}

describe("SalesHuman entity", () => {
  it("creates with valid props and exposes every getter", () => {
    const sales = unwrap(SalesHuman.create(validProps()));
    expect(sales.name).toBe("Budi Santoso");
    expect(sales.waNumber).toBe("+628120000001");
    expect(sales.branchId).toBe(BranchId.BINTARO);
    expect(sales.status).toBe(SalesStatus.ON);
    expect(sales.maxLeadsPerDay.toNumber()).toBe(10);
    expect(sales.activeLeadCount.toNumber()).toBe(0);
    expect(sales.todayLeadCount.toNumber()).toBe(0);
    expect(sales.joinedAt).toBe(JOINED_AT);
    expect(sales.lastActiveAt).toBeUndefined();
  });

  it("rejects an empty name", () => {
    expect(unwrapErr(SalesHuman.create(validProps({ name: "" }))).message).toContain(
      "name must be",
    );
  });

  it("rejects an empty waNumber", () => {
    expect(unwrapErr(SalesHuman.create(validProps({ waNumber: "  " }))).message).toContain(
      "waNumber must be",
    );
  });

  it("rejects an invalid status", () => {
    expect(
      unwrapErr(SalesHuman.create(validProps({ status: "AWAY" as unknown as SalesStatus })))
        .message,
    ).toContain("status is invalid");
  });

  it("rejects lastActiveAt preceding joinedAt", () => {
    expect(
      unwrapErr(
        SalesHuman.create(validProps({ lastActiveAt: new Date("2025-01-01T00:00:00.000Z") })),
      ).message,
    ).toContain("lastActiveAt must not precede joinedAt");
  });

  it("accepts lastActiveAt equal to or after joinedAt", () => {
    const sales = unwrap(SalesHuman.create(validProps({ lastActiveAt: JOINED_AT })));
    expect(sales.lastActiveAt).toBe(JOINED_AT);
  });

  describe("isAvailable", () => {
    it("ON + quota remaining -> true", () => {
      const sales = unwrap(
        SalesHuman.create(
          validProps({ status: SalesStatus.ON, todayLeadCount: DailyLeadCount.zero() }),
        ),
      );
      expect(sales.isAvailable).toBe(true);
    });

    it("BUSY -> false", () => {
      const sales = unwrap(SalesHuman.create(validProps({ status: SalesStatus.BUSY })));
      expect(sales.isAvailable).toBe(false);
    });

    it("OFF -> false", () => {
      const sales = unwrap(SalesHuman.create(validProps({ status: SalesStatus.OFF })));
      expect(sales.isAvailable).toBe(false);
    });

    it("ON + quota full -> false (quota_enforcement: maxLeadsPerDay=10, todayLeadCount=10)", () => {
      const sales = unwrap(
        SalesHuman.create(
          validProps({
            status: SalesStatus.ON,
            maxLeadsPerDay: unwrap(MaxLeadsPerDay.create(10)),
            todayLeadCount: unwrap(DailyLeadCount.create(10)),
          }),
        ),
      );
      expect(sales.isAvailable).toBe(false);
    });
  });

  describe("capacityRemaining", () => {
    it("equals maxLeadsPerDay - todayLeadCount", () => {
      const sales = unwrap(
        SalesHuman.create(
          validProps({
            maxLeadsPerDay: unwrap(MaxLeadsPerDay.create(10)),
            todayLeadCount: unwrap(DailyLeadCount.create(4)),
          }),
        ),
      );
      expect(sales.capacityRemaining).toBe(6);
    });

    it("floors at 0 when todayLeadCount meets maxLeadsPerDay", () => {
      const sales = unwrap(
        SalesHuman.create(
          validProps({
            maxLeadsPerDay: unwrap(MaxLeadsPerDay.create(10)),
            todayLeadCount: unwrap(DailyLeadCount.create(10)),
          }),
        ),
      );
      expect(sales.capacityRemaining).toBe(0);
    });
  });

  describe("withStatus", () => {
    it("returns a new instance with the updated status and lastActiveAt", () => {
      const sales = unwrap(SalesHuman.create(validProps()));
      const at = new Date("2026-02-01T00:00:00.000Z");
      const updated = sales.withStatus(SalesStatus.BUSY, at);
      expect(updated.status).toBe(SalesStatus.BUSY);
      expect(updated.lastActiveAt).toBe(at);
      expect(sales.status).toBe(SalesStatus.ON);
      expect(updated).not.toBe(sales);
    });
  });

  describe("withIncrementedLeadCounts", () => {
    it("increments both activeLeadCount and todayLeadCount", () => {
      const sales = unwrap(SalesHuman.create(validProps()));
      const at = new Date("2026-02-01T00:00:00.000Z");
      const updated = sales.withIncrementedLeadCounts(at);
      expect(updated.activeLeadCount.toNumber()).toBe(1);
      expect(updated.todayLeadCount.toNumber()).toBe(1);
      expect(updated.lastActiveAt).toBe(at);
      expect(sales.activeLeadCount.toNumber()).toBe(0);
      expect(updated).not.toBe(sales);
    });
  });

  describe("withResetDailyCount", () => {
    it("resets todayLeadCount to 0, preserving activeLeadCount", () => {
      const sales = unwrap(
        SalesHuman.create(
          validProps({
            activeLeadCount: unwrap(ActiveLeadCount.create(3)),
            todayLeadCount: unwrap(DailyLeadCount.create(7)),
          }),
        ),
      );
      const reset = sales.withResetDailyCount();
      expect(reset.todayLeadCount.toNumber()).toBe(0);
      expect(reset.activeLeadCount.toNumber()).toBe(3);
      expect(reset).not.toBe(sales);
    });
  });
});
