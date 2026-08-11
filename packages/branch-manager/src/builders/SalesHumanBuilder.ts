import { err, type Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import { SalesHuman } from "../domain/entities/SalesHuman.js";
import { ActiveLeadCount } from "../domain/value-objects/ActiveLeadCount.js";
import { BranchId } from "../domain/value-objects/BranchId.js";
import { DailyLeadCount } from "../domain/value-objects/DailyLeadCount.js";
import { MaxLeadsPerDay } from "../domain/value-objects/MaxLeadsPerDay.js";
import { SalesHumanId } from "../domain/value-objects/SalesHumanId.js";
import { SalesStatus } from "../domain/value-objects/SalesStatus.js";

/** Fluent builder (Builder Pattern) for `SalesHuman`, with sensible defaults so callers only override what matters for their scenario. */
export class SalesHumanBuilder {
  private id: SalesHumanId = SalesHumanId.generate();
  private name = "Budi Santoso";
  private waNumber = "+628120000001";
  private branchId: BranchId = BranchId.BINTARO;
  private status: SalesStatus = SalesStatus.ON;
  private maxLeadsPerDay = 10;
  private activeLeadCount = 0;
  private todayLeadCount = 0;
  private joinedAt = new Date("2026-01-01T00:00:00.000Z");
  private lastActiveAt: Date | undefined;

  withId(id: SalesHumanId): this {
    this.id = id;
    return this;
  }

  withName(name: string): this {
    this.name = name;
    return this;
  }

  withWaNumber(waNumber: string): this {
    this.waNumber = waNumber;
    return this;
  }

  withBranchId(branchId: BranchId): this {
    this.branchId = branchId;
    return this;
  }

  withStatus(status: SalesStatus): this {
    this.status = status;
    return this;
  }

  withMaxLeadsPerDay(max: number): this {
    this.maxLeadsPerDay = max;
    return this;
  }

  withActiveLeadCount(count: number): this {
    this.activeLeadCount = count;
    return this;
  }

  withTodayLeadCount(count: number): this {
    this.todayLeadCount = count;
    return this;
  }

  withJoinedAt(at: Date): this {
    this.joinedAt = at;
    return this;
  }

  withLastActiveAt(at: Date): this {
    this.lastActiveAt = at;
    return this;
  }

  build(): Result<SalesHuman, ValidationError> {
    const maxLeadsResult = MaxLeadsPerDay.create(this.maxLeadsPerDay);
    if (!maxLeadsResult.ok) {
      return err(maxLeadsResult.error);
    }
    const activeLeadCountResult = ActiveLeadCount.create(this.activeLeadCount);
    if (!activeLeadCountResult.ok) {
      return err(activeLeadCountResult.error);
    }
    const todayLeadCountResult = DailyLeadCount.create(this.todayLeadCount);
    if (!todayLeadCountResult.ok) {
      return err(todayLeadCountResult.error);
    }

    return SalesHuman.create({
      id: this.id,
      name: this.name,
      waNumber: this.waNumber,
      branchId: this.branchId,
      status: this.status,
      maxLeadsPerDay: maxLeadsResult.value,
      activeLeadCount: activeLeadCountResult.value,
      todayLeadCount: todayLeadCountResult.value,
      joinedAt: this.joinedAt,
      lastActiveAt: this.lastActiveAt,
    });
  }
}
