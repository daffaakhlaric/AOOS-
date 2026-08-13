import { err, ok } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import { CapiEventService } from "../../../src/application/services/CapiEventService.js";
import { EventHasherService } from "../../../src/application/services/EventHasherService.js";
import type { IEventBatcher } from "../../../src/contracts/IEventBatcher.js";
import type { EventResult } from "../../../src/domain/entities/EventResult.js";
import { CapiError } from "../../../src/domain/errors/CapiError.js";
import { HashingError } from "../../../src/domain/errors/HashingError.js";
import { EventName } from "../../../src/domain/value-objects/EventName.js";
import { ClosingToCapiEventMapper } from "../../../src/mappers/ClosingToCapiEventMapper.js";
import { LeadToCapiEventMapper } from "../../../src/mappers/LeadToCapiEventMapper.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const hasher = new EventHasherService();
const leadMapper = new LeadToCapiEventMapper(hasher, "https://mobixbydss.id");
const closingMapper = new ClosingToCapiEventMapper(hasher, "https://mobixbydss.id");
const occurredAt = new Date("2024-08-09T14:03:00.000Z");
const ctx = { tenantId: "t1", correlationId: "c1" };

function fakeBatcher(result: readonly EventResult[] = []): IEventBatcher {
  return {
    add: vi.fn(async (): Promise<ReturnType<IEventBatcher["add"]>> => ok(result)),
    flush: vi.fn(async (): Promise<ReturnType<IEventBatcher["flush"]>> => ok(result)),
  };
}

describe("CapiEventService", () => {
  it("sendContact maps + batches, returning the flushed EventResult", async () => {
    const batcher = fakeBatcher([
      { eventName: EventName.CONTACT, success: true, fbtraceId: "trace-1" },
    ]);
    const service = new CapiEventService(leadMapper, closingMapper, batcher);
    const result = unwrap(
      await service.sendContact({ phone: "+628123456789", adId: "ad-1", occurredAt, ...ctx }),
    );
    expect(result).toEqual({ eventName: EventName.CONTACT, success: true, fbtraceId: "trace-1" });
    expect(batcher.add).toHaveBeenCalledTimes(1);
  });

  it("sendInitiateCheckout maps + batches", async () => {
    const batcher = fakeBatcher([{ eventName: EventName.INITIATE_CHECKOUT, success: true }]);
    const service = new CapiEventService(leadMapper, closingMapper, batcher);
    const result = unwrap(
      await service.sendInitiateCheckout({ phone: "+628123456789", occurredAt, ...ctx }),
    );
    expect(result.eventName).toBe(EventName.INITIATE_CHECKOUT);
  });

  it("sendAddToWishlist maps + batches", async () => {
    const batcher = fakeBatcher([{ eventName: EventName.ADD_TO_WISHLIST, success: true }]);
    const service = new CapiEventService(leadMapper, closingMapper, batcher);
    const result = unwrap(
      await service.sendAddToWishlist({ phone: "+628123456789", occurredAt, ...ctx }),
    );
    expect(result.eventName).toBe(EventName.ADD_TO_WISHLIST);
  });

  it("sendLead maps + batches", async () => {
    const batcher = fakeBatcher([{ eventName: EventName.LEAD, success: true }]);
    const service = new CapiEventService(leadMapper, closingMapper, batcher);
    const result = unwrap(
      await service.sendLead({ phone: "+628123456789", unitId: "unit-1", occurredAt, ...ctx }),
    );
    expect(result.eventName).toBe(EventName.LEAD);
  });

  it("sendPurchase maps + batches", async () => {
    const batcher = fakeBatcher([{ eventName: EventName.PURCHASE, success: true }]);
    const service = new CapiEventService(leadMapper, closingMapper, batcher);
    const result = unwrap(
      await service.sendPurchase({
        phone: "+628123456789",
        unitId: "unit-1",
        unitPrice: 195_000_000,
        occurredAt,
        ...ctx,
      }),
    );
    expect(result.eventName).toBe(EventName.PURCHASE);
  });

  it("returns pending:true when the batcher buffers without flushing (batchSize > 1)", async () => {
    const batcher = fakeBatcher([]);
    const service = new CapiEventService(leadMapper, closingMapper, batcher);
    const result = unwrap(
      await service.sendContact({ phone: "+628123456789", occurredAt, ...ctx }),
    );
    expect(result).toEqual({ eventName: EventName.CONTACT, success: true, pending: true });
  });

  it("propagates a HashingError from the mapper without calling the batcher", async () => {
    const batcher = fakeBatcher();
    const service = new CapiEventService(leadMapper, closingMapper, batcher);
    const error = unwrapErr(await service.sendContact({ phone: "", occurredAt, ...ctx }));
    expect(error).toBeInstanceOf(HashingError);
    expect(batcher.add).not.toHaveBeenCalled();
  });

  it("propagates a CapiError from the batcher", async () => {
    const batcher: IEventBatcher = {
      add: vi.fn(async () => err(new CapiError("batch failed"))),
      flush: vi.fn(async () => err(new CapiError("batch failed"))),
    };
    const service = new CapiEventService(leadMapper, closingMapper, batcher);
    const error = unwrapErr(
      await service.sendContact({ phone: "+628123456789", occurredAt, ...ctx }),
    );
    expect(error.message).toBe("batch failed");
  });

  it("sendLead propagates a mapper HashingError without calling the batcher", async () => {
    const batcher = fakeBatcher();
    const service = new CapiEventService(leadMapper, closingMapper, batcher);
    const error = unwrapErr(
      await service.sendLead({ phone: "", unitId: "unit-1", occurredAt, ...ctx }),
    );
    expect(error).toBeInstanceOf(HashingError);
    expect(batcher.add).not.toHaveBeenCalled();
  });

  it("sendLead propagates a batcher error", async () => {
    const batcher: IEventBatcher = {
      add: vi.fn(async () => err(new CapiError("batch failed"))),
      flush: vi.fn(async () => err(new CapiError("batch failed"))),
    };
    const service = new CapiEventService(leadMapper, closingMapper, batcher);
    const error = unwrapErr(
      await service.sendLead({ phone: "+628123456789", unitId: "unit-1", occurredAt, ...ctx }),
    );
    expect(error.message).toBe("batch failed");
  });

  it("sendPurchase propagates a mapper HashingError", async () => {
    const batcher = fakeBatcher();
    const service = new CapiEventService(leadMapper, closingMapper, batcher);
    const error = unwrapErr(
      await service.sendPurchase({ phone: "", unitPrice: 195_000_000, occurredAt, ...ctx }),
    );
    expect(error).toBeInstanceOf(HashingError);
  });
});
