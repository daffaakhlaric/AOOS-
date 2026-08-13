import { describe, expect, it } from "vitest";

import { CapiEvent } from "../../../../src/domain/entities/CapiEvent.js";
import { ActionSource } from "../../../../src/domain/value-objects/ActionSource.js";
import { CurrencyCode } from "../../../../src/domain/value-objects/CurrencyCode.js";
import { EventName } from "../../../../src/domain/value-objects/EventName.js";
import { EventSourceUrl } from "../../../../src/domain/value-objects/EventSourceUrl.js";
import { EventTime } from "../../../../src/domain/value-objects/EventTime.js";
import { HashedPhone } from "../../../../src/domain/value-objects/HashedPhone.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

const eventTime = unwrap(EventTime.fromDate(new Date("2024-08-09T14:03:00.000Z")));
const eventSourceUrl = unwrap(EventSourceUrl.create("https://mobixbydss.id"));
const phoneHash = "a".repeat(64);
const hashedPhone = unwrap(HashedPhone.create(phoneHash));

describe("CapiEvent", () => {
  it("creates a Contact event with no custom_data", () => {
    const event = unwrap(
      CapiEvent.create({
        eventName: EventName.CONTACT,
        eventTime,
        eventSourceUrl,
        actionSource: ActionSource.website(),
        userData: { ph: [hashedPhone], country: ["hashed-id"], clientUserAgent: "" },
      }),
    );
    expect(event.eventName).toBe(EventName.CONTACT);
    expect(event.customData).toBeUndefined();
    expect(event.eventTime).toBe(eventTime);
  });

  it("rejects a negative custom_data.value", () => {
    const error = unwrapErr(
      CapiEvent.create({
        eventName: EventName.PURCHASE,
        eventTime,
        eventSourceUrl,
        actionSource: ActionSource.website(),
        userData: { ph: [hashedPhone], country: ["hashed-id"], clientUserAgent: "" },
        customData: { value: -1, currency: CurrencyCode.idr() },
      }),
    );
    expect(error.message).toContain("CapiEvent.customData.value must not be negative");
  });

  describe("toWireFormat", () => {
    it("converts to Meta CAPI's exact wire JSON shape for a Purchase event", () => {
      const event = unwrap(
        CapiEvent.create({
          eventName: EventName.PURCHASE,
          eventTime,
          eventSourceUrl,
          actionSource: ActionSource.website(),
          userData: { ph: [hashedPhone], country: ["hashed-id"], clientUserAgent: "" },
          customData: {
            value: 195_000_000,
            currency: CurrencyCode.idr(),
            contentIds: ["unit-123"],
            contentType: "product",
          },
        }),
      );

      expect(event.toWireFormat()).toEqual({
        event_name: "Purchase",
        event_time: 1723212180,
        event_source_url: "https://mobixbydss.id",
        action_source: "website",
        user_data: {
          ph: [phoneHash],
          fn: undefined,
          country: ["hashed-id"],
          client_user_agent: "",
        },
        custom_data: {
          value: 195_000_000,
          currency: "IDR",
          content_ids: ["unit-123"],
          content_type: "product",
        },
      });
    });

    it("omits custom_data entirely when the event has none", () => {
      const event = unwrap(
        CapiEvent.create({
          eventName: EventName.CONTACT,
          eventTime,
          eventSourceUrl,
          actionSource: ActionSource.website(),
          userData: { ph: [hashedPhone], country: ["hashed-id"], clientUserAgent: "" },
        }),
      );
      expect(event.toWireFormat().custom_data).toBeUndefined();
    });
  });
});
