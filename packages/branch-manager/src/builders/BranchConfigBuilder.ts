import { err, type Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import { BranchConfig } from "../domain/entities/BranchConfig.js";
import { AssignmentMode } from "../domain/value-objects/AssignmentMode.js";
import { BranchId } from "../domain/value-objects/BranchId.js";
import { MaxLeadsPerDay } from "../domain/value-objects/MaxLeadsPerDay.js";
import { WabaPhoneNumberId } from "../domain/value-objects/WabaPhoneNumberId.js";

/** Fluent builder (Builder Pattern) for `BranchConfig`, with sensible defaults so callers (`BranchManagerFactory`'s DSS Motor seed, and tests) only override what matters for their scenario. */
export class BranchConfigBuilder {
  private id: BranchId = BranchId.BINTARO;
  private name = "Mobix Bintaro";
  private displayName = "Cabang Bintaro";
  private wabaPhoneNumberIdRaw = "PHONE_NUMBER_ID_BINTARO";
  private wabaPhoneNumber = "+628110000001";
  private assignmentMode: AssignmentMode = AssignmentMode.SMART_ASSIGN;
  private maxLeadsPerSalesPerDay = 10;
  private managerWaNumber: string | undefined;
  private active = true;

  withId(id: BranchId): this {
    this.id = id;
    return this;
  }

  withName(name: string): this {
    this.name = name;
    return this;
  }

  withDisplayName(displayName: string): this {
    this.displayName = displayName;
    return this;
  }

  withWabaPhoneNumberId(raw: string): this {
    this.wabaPhoneNumberIdRaw = raw;
    return this;
  }

  withWabaPhoneNumber(waNumber: string): this {
    this.wabaPhoneNumber = waNumber;
    return this;
  }

  withAssignmentMode(mode: AssignmentMode): this {
    this.assignmentMode = mode;
    return this;
  }

  withMaxLeadsPerSalesPerDay(max: number): this {
    this.maxLeadsPerSalesPerDay = max;
    return this;
  }

  withManagerWaNumber(waNumber: string): this {
    this.managerWaNumber = waNumber;
    return this;
  }

  withActive(active: boolean): this {
    this.active = active;
    return this;
  }

  build(): Result<BranchConfig, ValidationError> {
    const phoneNumberIdResult = WabaPhoneNumberId.create(this.wabaPhoneNumberIdRaw);
    if (!phoneNumberIdResult.ok) {
      return err(phoneNumberIdResult.error);
    }
    const maxLeadsResult = MaxLeadsPerDay.create(this.maxLeadsPerSalesPerDay);
    if (!maxLeadsResult.ok) {
      return err(maxLeadsResult.error);
    }

    return BranchConfig.create({
      id: this.id,
      name: this.name,
      displayName: this.displayName,
      wabaPhoneNumberId: phoneNumberIdResult.value,
      wabaPhoneNumber: this.wabaPhoneNumber,
      assignmentMode: this.assignmentMode,
      maxLeadsPerSalesPerDay: maxLeadsResult.value,
      managerWaNumber: this.managerWaNumber,
      active: this.active,
    });
  }
}
