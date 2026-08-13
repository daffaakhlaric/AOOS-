import { err } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { describe, expect, it, vi } from "vitest";

import { EventHasherService } from "../../../src/application/services/EventHasherService.js";
import { CapiEvent } from "../../../src/domain/entities/CapiEvent.js";
import { EventName } from "../../../src/domain/value-objects/EventName.js";
import { ClosingToCapiEventMapper } from "../../../src/mappers/ClosingToCapiEventMapper.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const hasher = new EventHasherService();
const mapper = new ClosingToCapiEventMapper(hasher, "https://mobixbydss.id");
const occurredAt = new Date("2024-08-09T14:03:00.000Z");

describe("ClosingToCapiEventMapper", () => {
  it('TEST_DRIVE closing -> event_name="Lead"', () => {
    const event = unwrap(mapper.toLead({ phone: "+628123456789", unitId: "unit-123", occurredAt }));
    expect(event.eventName).toBe(EventName.LEAD);
    expect(event.toWireFormat().event_name).toBe("Lead");
  });

  it('SPK closing -> event_name="Purchase"', () => {
    const event = unwrap(
      mapper.toPurchase({
        phone: "+628123456789",
        unitId: "unit-123",
        unitPrice: 195_000_000,
        occurredAt,
      }),
    );
    expect(event.eventName).toBe(EventName.PURCHASE);
    expect(event.toWireFormat().event_name).toBe("Purchase");
  });

  it("Purchase custom_data.value = unitPrice (IDR, exact)", () => {
    const event = unwrap(
      mapper.toPurchase({
        phone: "+628123456789",
        unitId: "unit-123",
        unitPrice: 195_000_000,
        occurredAt,
      }),
    );
    expect(event.toWireFormat().custom_data?.value).toBe(195_000_000);
  });

  it('Purchase custom_data.currency = "IDR"', () => {
    const event = unwrap(
      mapper.toPurchase({
        phone: "+628123456789",
        unitId: "unit-123",
        unitPrice: 195_000_000,
        occurredAt,
      }),
    );
    expect(event.toWireFormat().custom_data?.currency).toBe("IDR");
  });

  it("Purchase content_ids = [unitId] with content_type=product", () => {
    const event = unwrap(
      mapper.toPurchase({
        phone: "+628123456789",
        unitId: "unit-123",
        unitPrice: 195_000_000,
        occurredAt,
      }),
    );
    expect(event.toWireFormat().custom_data).toMatchObject({
      content_ids: ["unit-123"],
      content_type: "product",
    });
  });

  it("Lead event content_ids = [unitId], no value/currency", () => {
    const event = unwrap(mapper.toLead({ phone: "+628123456789", unitId: "unit-123", occurredAt }));
    expect(event.toWireFormat().custom_data).toEqual({
      value: undefined,
      currency: undefined,
      content_ids: ["unit-123"],
      content_type: "product",
    });
  });

  it("Purchase still carries value/currency even when unitId is absent", () => {
    const event = unwrap(
      mapper.toPurchase({ phone: "+628123456789", unitPrice: 195_000_000, occurredAt }),
    );
    expect(event.toWireFormat().custom_data).toEqual({
      value: 195_000_000,
      currency: "IDR",
      content_ids: undefined,
      content_type: undefined,
    });
  });

  it("Lead event with neither unitId nor a name omits custom_data entirely", () => {
    const event = unwrap(mapper.toLead({ phone: "+628123456789", occurredAt }));
    expect(event.toWireFormat().custom_data).toBeUndefined();
  });

  it("includes user_data.fn when a name is provided (success path)", () => {
    const event = unwrap(
      mapper.toLead({ phone: "+628123456789", name: "Budi Santoso", unitId: "unit-1", occurredAt }),
    );
    expect(event.toWireFormat().user_data.fn).toBeDefined();
  });

  it("propagates a HashingError from an unhashable phone", () => {
    const error = unwrapErr(mapper.toLead({ phone: "", unitId: "unit-123", occurredAt }));
    expect(error.name).toBe("HashingError");
  });

  it("propagates a HashingError from an unhashable name", () => {
    const error = unwrapErr(mapper.toLead({ phone: "+628123456789", name: "   ", occurredAt }));
    expect(error.name).toBe("HashingError");
  });

  it("wraps an EventTime validation failure (invalid Date) as HashingError", () => {
    const error = unwrapErr(
      mapper.toLead({ phone: "+628123456789", occurredAt: new Date("not-a-date") }),
    );
    expect(error.name).toBe("HashingError");
  });

  it("wraps an EventSourceUrl validation failure as HashingError", () => {
    const badMapper = new ClosingToCapiEventMapper(hasher, "not-a-url");
    const error = unwrapErr(badMapper.toLead({ phone: "+628123456789", occurredAt }));
    expect(error.name).toBe("HashingError");
  });

  it("wraps a CapiEvent.create validation failure (negative Purchase value) as HashingError", () => {
    const error = unwrapErr(
      mapper.toPurchase({ phone: "+628123456789", unitPrice: -1, occurredAt }),
    );
    expect(error.name).toBe("HashingError");
    expect(error.message).toContain("must not be negative");
  });

  it("wraps a CapiEvent.create validation failure as HashingError (spy-based defensive path)", () => {
    const spy = vi
      .spyOn(CapiEvent, "create")
      .mockReturnValueOnce(err(new ValidationError("unreachable")));
    const error = unwrapErr(
      mapper.toLead({ phone: "+628123456789", unitId: "unit-1", occurredAt }),
    );
    expect(error.name).toBe("HashingError");
    spy.mockRestore();
  });
});
