import { ok } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import { SendLeadEvent } from "../../../src/application/use-cases/SendLeadEvent.js";
import { EventName } from "../../../src/domain/value-objects/EventName.js";

describe("SendLeadEvent", () => {
  it("delegates to CapiEventService.sendLead", async () => {
    const capiEventService = {
      sendLead: vi.fn(async () => ok({ eventName: EventName.LEAD, success: true })),
    };
    const useCase = new SendLeadEvent(capiEventService as never);
    const input = {
      phone: "+628123456789",
      unitId: "unit-1",
      occurredAt: new Date(),
      tenantId: "t1",
      correlationId: "c1",
    };
    const result = await useCase.execute(input);
    expect(capiEventService.sendLead).toHaveBeenCalledWith(input);
    expect(result).toEqual(ok({ eventName: EventName.LEAD, success: true }));
  });
});
