import { describe, expect, it } from "vitest";

import { CapiBatch } from "../../../src/domain/entities/CapiBatch.js";
import { CapiEvent } from "../../../src/domain/entities/CapiEvent.js";
import { ActionSource } from "../../../src/domain/value-objects/ActionSource.js";
import { EventName } from "../../../src/domain/value-objects/EventName.js";
import { EventSourceUrl } from "../../../src/domain/value-objects/EventSourceUrl.js";
import { EventTime } from "../../../src/domain/value-objects/EventTime.js";
import { HashedPhone } from "../../../src/domain/value-objects/HashedPhone.js";
import { CapiRequestBuilder } from "../../../src/infrastructure/meta-api/CapiRequestBuilder.js";
import { buildConfig } from "../../helpers/config.js";
import { unwrap } from "../../helpers/result.js";

function makeBatch(): CapiBatch {
  const event = unwrap(
    CapiEvent.create({
      eventName: EventName.CONTACT,
      eventTime: unwrap(EventTime.fromDate(new Date("2024-08-09T14:03:00.000Z"))),
      eventSourceUrl: unwrap(EventSourceUrl.create("https://mobixbydss.id")),
      actionSource: ActionSource.website(),
      userData: {
        ph: [unwrap(HashedPhone.create("a".repeat(64)))],
        country: ["x"],
        clientUserAgent: "",
      },
    }),
  );
  return unwrap(CapiBatch.create([event]));
}

describe("CapiRequestBuilder", () => {
  it("eventsUrl builds POST /{api-version}/{pixel-id}/events", () => {
    const config = buildConfig({ pixelId: "123456789" });
    expect(CapiRequestBuilder.eventsUrl(config)).toBe(
      "https://graph.facebook.com/v21.0/123456789/events",
    );
  });

  it("eventsBody carries access_token in the body (not a URL param)", () => {
    const config = buildConfig({ accessToken: "TOKEN123" });
    const body = CapiRequestBuilder.eventsBody(makeBatch(), config);
    expect(body.access_token).toBe("TOKEN123");
    expect(body.data).toHaveLength(1);
  });

  it("eventsBody omits test_event_code when not configured", () => {
    const config = buildConfig({ testEventCode: undefined });
    const body = CapiRequestBuilder.eventsBody(makeBatch(), config);
    expect(body.test_event_code).toBeUndefined();
  });

  it("eventsBody includes test_event_code when configured", () => {
    const config = buildConfig({ testEventCode: "TEST12345" });
    const body = CapiRequestBuilder.eventsBody(makeBatch(), config);
    expect(body.test_event_code).toBe("TEST12345");
  });

  it("emqUrl builds a GET URL with access_token as a query param", () => {
    const config = buildConfig({ pixelId: "123456789", accessToken: "TOKEN123" });
    const url = CapiRequestBuilder.emqUrl(config);
    expect(url).toContain("https://graph.facebook.com/v21.0/123456789?");
    expect(url).toContain("access_token=TOKEN123");
  });
});
