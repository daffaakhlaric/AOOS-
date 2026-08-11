import { describe, expect, it } from "vitest";

import { ApiResponseMapper } from "../../../src/infrastructure/whatsapp-api/ApiResponseMapper.js";
import { waSendMessageResponseJson } from "../../fixtures/waFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("ApiResponseMapper.toSendMessageResponse", () => {
  it("maps a valid response", () => {
    const response = unwrap(
      ApiResponseMapper.toSendMessageResponse(waSendMessageResponseJson("wamid.abc")),
    );
    expect(response.messages[0]?.id).toBe("wamid.abc");
  });

  it("rejects a response missing required fields", () => {
    const error = unwrapErr(ApiResponseMapper.toSendMessageResponse({ foo: "bar" }));
    expect(error).toBeDefined();
  });
});
