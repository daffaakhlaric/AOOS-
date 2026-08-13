import { describe, expect, it } from "vitest";

import { EventName, isEventName } from "../../../../src/domain/value-objects/EventName.js";

describe("EventName", () => {
  it("has the 5 spec-pinned Meta CAPI standard event names", () => {
    expect(EventName.CONTACT).toBe("Contact");
    expect(EventName.INITIATE_CHECKOUT).toBe("InitiateCheckout");
    expect(EventName.ADD_TO_WISHLIST).toBe("AddToWishlist");
    expect(EventName.LEAD).toBe("Lead");
    expect(EventName.PURCHASE).toBe("Purchase");
  });

  describe("isEventName", () => {
    it("returns true for every known EventName value", () => {
      for (const value of Object.values(EventName)) {
        expect(isEventName(value)).toBe(true);
      }
    });

    it("returns false for an unknown string", () => {
      expect(isEventName("ViewContent")).toBe(false);
      expect(isEventName("")).toBe(false);
    });
  });
});
