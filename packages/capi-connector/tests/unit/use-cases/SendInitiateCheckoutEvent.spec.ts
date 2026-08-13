import { ok } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import { SendInitiateCheckoutEvent } from "../../../src/application/use-cases/SendInitiateCheckoutEvent.js";
import { EventName } from "../../../src/domain/value-objects/EventName.js";

describe("SendInitiateCheckoutEvent", () => {
  it("delegates to CapiEventService.sendInitiateCheckout", async () => {
    const capiEventService = {
      sendInitiateCheckout: vi.fn(async () =>
        ok({ eventName: EventName.INITIATE_CHECKOUT, success: true }),
      ),
    };
    const useCase = new SendInitiateCheckoutEvent(capiEventService as never);
    const input = {
      phone: "+628123456789",
      occurredAt: new Date(),
      tenantId: "t1",
      correlationId: "c1",
    };
    const result = await useCase.execute(input);
    expect(capiEventService.sendInitiateCheckout).toHaveBeenCalledWith(input);
    expect(result).toEqual(ok({ eventName: EventName.INITIATE_CHECKOUT, success: true }));
  });
});
