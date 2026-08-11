import { describe, expect, it } from "vitest";

import { MessageStatus } from "../../../src/domain/value-objects/MessageStatus.js";
import { MessageStatusMapper } from "../../../src/mappers/MessageStatusMapper.js";
import type { WaWebhookStatus } from "../../../src/types/WhatsAppWebhookTypes.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("MessageStatusMapper.map", () => {
  it("maps a delivered status", () => {
    const raw: WaWebhookStatus = {
      id: "wamid.1",
      status: "delivered",
      timestamp: "1700000000",
      recipient_id: "628123456789",
    };
    const mapped = unwrap(MessageStatusMapper.map(raw));
    expect(mapped.status).toBe(MessageStatus.DELIVERED);
    expect(mapped.at.getTime()).toBe(1_700_000_000 * 1000);
    expect(mapped.errorCode).toBeUndefined();
  });

  it("maps sent/read/failed statuses", () => {
    for (const [wire, expected] of [
      ["sent", MessageStatus.SENT],
      ["read", MessageStatus.READ],
      ["failed", MessageStatus.FAILED],
    ] as const) {
      const raw: WaWebhookStatus = {
        id: "wamid.1",
        status: wire,
        timestamp: "1700000000",
        recipient_id: "628123456789",
      };
      const mapped = unwrap(MessageStatusMapper.map(raw));
      expect(mapped.status).toBe(expected);
    }
  });

  it("maps a failed status with error details", () => {
    const raw: WaWebhookStatus = {
      id: "wamid.1",
      status: "failed",
      timestamp: "1700000000",
      recipient_id: "628123456789",
      errors: [{ code: 131047, title: "Re-engagement message" }],
    };
    const mapped = unwrap(MessageStatusMapper.map(raw));
    expect(mapped.errorCode).toBe(131047);
    expect(mapped.errorTitle).toBe("Re-engagement message");
  });

  it("rejects a non-numeric timestamp", () => {
    const raw: WaWebhookStatus = {
      id: "wamid.1",
      status: "sent",
      timestamp: "nope",
      recipient_id: "628123456789",
    };
    const error = unwrapErr(MessageStatusMapper.map(raw));
    expect(error.message).toContain("timestamp");
  });
});
