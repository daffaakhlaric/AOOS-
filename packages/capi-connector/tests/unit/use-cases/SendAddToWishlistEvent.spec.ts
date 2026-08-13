import { ok } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import { SendAddToWishlistEvent } from "../../../src/application/use-cases/SendAddToWishlistEvent.js";
import { EventName } from "../../../src/domain/value-objects/EventName.js";

describe("SendAddToWishlistEvent", () => {
  it("delegates to CapiEventService.sendAddToWishlist", async () => {
    const capiEventService = {
      sendAddToWishlist: vi.fn(async () =>
        ok({ eventName: EventName.ADD_TO_WISHLIST, success: true }),
      ),
    };
    const useCase = new SendAddToWishlistEvent(capiEventService as never);
    const input = {
      phone: "+628123456789",
      occurredAt: new Date(),
      tenantId: "t1",
      correlationId: "c1",
    };
    const result = await useCase.execute(input);
    expect(capiEventService.sendAddToWishlist).toHaveBeenCalledWith(input);
    expect(result).toEqual(ok({ eventName: EventName.ADD_TO_WISHLIST, success: true }));
  });
});
