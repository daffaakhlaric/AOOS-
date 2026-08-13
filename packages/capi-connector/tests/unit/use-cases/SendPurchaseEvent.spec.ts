import { ok } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import { SendPurchaseEvent } from "../../../src/application/use-cases/SendPurchaseEvent.js";
import { EventName } from "../../../src/domain/value-objects/EventName.js";

describe("SendPurchaseEvent", () => {
  it("delegates to CapiEventService.sendPurchase", async () => {
    const capiEventService = {
      sendPurchase: vi.fn(async () => ok({ eventName: EventName.PURCHASE, success: true })),
    };
    const useCase = new SendPurchaseEvent(capiEventService as never);
    const input = {
      phone: "+628123456789",
      unitId: "unit-1",
      unitPrice: 195_000_000,
      occurredAt: new Date(),
      tenantId: "t1",
      correlationId: "c1",
    };
    const result = await useCase.execute(input);
    expect(capiEventService.sendPurchase).toHaveBeenCalledWith(input);
    expect(result).toEqual(ok({ eventName: EventName.PURCHASE, success: true }));
  });
});
