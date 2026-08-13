import { err } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { describe, expect, it, vi } from "vitest";

import {
  EventHasherService,
  hashPhone,
} from "../../../src/application/services/EventHasherService.js";
import { CapiEvent } from "../../../src/domain/entities/CapiEvent.js";
import { EventName } from "../../../src/domain/value-objects/EventName.js";
import { LeadToCapiEventMapper } from "../../../src/mappers/LeadToCapiEventMapper.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const hasher = new EventHasherService();
const mapper = new LeadToCapiEventMapper(hasher, "https://mobixbydss.id");
const occurredAt = new Date("2024-08-09T14:03:00.000Z");

describe("LeadToCapiEventMapper", () => {
  it('LeadCreated -> event_name="Contact"', () => {
    const event = unwrap(mapper.toContact({ phone: "+628123456789", adId: "ad-1", occurredAt }));
    expect(event.eventName).toBe(EventName.CONTACT);
    expect(event.toWireFormat().event_name).toBe("Contact");
  });

  it('LeadBecameHot -> event_name="AddToWishlist"', () => {
    const event = unwrap(
      mapper.toAddToWishlist({ phone: "+628123456789", adId: "ad-1", occurredAt }),
    );
    expect(event.eventName).toBe(EventName.ADD_TO_WISHLIST);
  });

  it('ScoreUpdated (score >= 30) -> event_name="InitiateCheckout"', () => {
    const event = unwrap(
      mapper.toInitiateCheckout({ phone: "+628123456789", adId: "ad-1", occurredAt }),
    );
    expect(event.eventName).toBe(EventName.INITIATE_CHECKOUT);
  });

  it("user_data.ph = [hashPhone(lead.phone)]", () => {
    const event = unwrap(mapper.toContact({ phone: "+628123456789", occurredAt }));
    expect(event.toWireFormat().user_data.ph).toEqual([hashPhone("+628123456789")]);
  });

  it('action_source = "website"', () => {
    const event = unwrap(mapper.toContact({ phone: "+628123456789", occurredAt }));
    expect(event.toWireFormat().action_source).toBe("website");
  });

  it('event_source_url = "https://mobixbydss.id"', () => {
    const event = unwrap(mapper.toContact({ phone: "+628123456789", occurredAt }));
    expect(event.toWireFormat().event_source_url).toBe("https://mobixbydss.id");
  });

  it("Contact/AddToWishlist include content_type=product when adId is present", () => {
    const contact = unwrap(mapper.toContact({ phone: "+628123456789", adId: "ad-1", occurredAt }));
    expect(contact.toWireFormat().custom_data).toEqual({
      value: undefined,
      currency: undefined,
      content_ids: ["ad-1"],
      content_type: "product",
    });
  });

  it("InitiateCheckout's custom_data has content_ids but no content_type (spec table)", () => {
    const event = unwrap(
      mapper.toInitiateCheckout({ phone: "+628123456789", adId: "ad-1", occurredAt }),
    );
    expect(event.toWireFormat().custom_data).toEqual({
      value: undefined,
      currency: undefined,
      content_ids: ["ad-1"],
      content_type: undefined,
    });
  });

  it("omits custom_data entirely when adId is absent", () => {
    const event = unwrap(mapper.toContact({ phone: "+628123456789", occurredAt }));
    expect(event.toWireFormat().custom_data).toBeUndefined();
  });

  it("includes user_data.fn when a name is provided", () => {
    const event = unwrap(
      mapper.toContact({ phone: "+628123456789", name: "Budi Santoso", occurredAt }),
    );
    expect(event.toWireFormat().user_data.fn).toBeDefined();
  });

  it("propagates a HashingError from an unhashable phone", () => {
    const error = unwrapErr(mapper.toContact({ phone: "", occurredAt }));
    expect(error.name).toBe("HashingError");
  });

  it("propagates a HashingError from an unhashable name", () => {
    const error = unwrapErr(mapper.toContact({ phone: "+628123456789", name: "   ", occurredAt }));
    expect(error.name).toBe("HashingError");
  });

  it("wraps an EventSourceUrl validation failure as HashingError", () => {
    const badMapper = new LeadToCapiEventMapper(hasher, "not-a-url");
    const error = unwrapErr(badMapper.toContact({ phone: "+628123456789", occurredAt }));
    expect(error.name).toBe("HashingError");
  });

  it("wraps an EventTime validation failure (invalid Date) as HashingError", () => {
    const error = unwrapErr(
      mapper.toContact({ phone: "+628123456789", occurredAt: new Date("not-a-date") }),
    );
    expect(error.name).toBe("HashingError");
  });

  it("wraps a CapiEvent.create validation failure as HashingError (defensive path — this mapper's own customData shape can never trip CapiEvent's negative-value guard)", () => {
    const spy = vi
      .spyOn(CapiEvent, "create")
      .mockReturnValueOnce(err(new ValidationError("unreachable")));
    const error = unwrapErr(mapper.toContact({ phone: "+628123456789", occurredAt }));
    expect(error.name).toBe("HashingError");
    expect(error.message).toBe("unreachable");
    spy.mockRestore();
  });
});
