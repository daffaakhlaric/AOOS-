import { ok } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import { SendContactEvent } from "../../../src/application/use-cases/SendContactEvent.js";
import { EventName } from "../../../src/domain/value-objects/EventName.js";

describe("SendContactEvent", () => {
  it("delegates to CapiEventService.sendContact", async () => {
    const capiEventService = {
      sendContact: vi.fn(async () => ok({ eventName: EventName.CONTACT, success: true })),
    };
    const useCase = new SendContactEvent(capiEventService as never);
    const input = {
      phone: "+628123456789",
      occurredAt: new Date(),
      tenantId: "t1",
      correlationId: "c1",
    };
    const result = await useCase.execute(input);
    expect(capiEventService.sendContact).toHaveBeenCalledWith(input);
    expect(result).toEqual(ok({ eventName: EventName.CONTACT, success: true }));
  });
});
