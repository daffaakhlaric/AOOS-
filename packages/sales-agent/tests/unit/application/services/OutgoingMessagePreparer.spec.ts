import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { prepareOutgoingMessage } from "../../../../src/application/services/OutgoingMessagePreparer.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("prepareOutgoingMessage", () => {
  it("builds a real @aos/whatsapp-connector OutgoingMessage", () => {
    const message = unwrap(prepareOutgoingMessage("+6281200000001", BranchId.CINERE, "Hai kak!"));
    expect(message.to.toString()).toBe("+6281200000001");
    expect(message.body.toString()).toBe("Hai kak!");
  });

  it("rejects an invalid (non-E.164) phone number", () => {
    expect(
      unwrapErr(prepareOutgoingMessage("0812", BranchId.CINERE, "Hai kak!")).message,
    ).toContain("PhoneNumber");
  });

  it("rejects an empty message body", () => {
    expect(
      unwrapErr(prepareOutgoingMessage("+6281200000001", BranchId.CINERE, "")).message.length,
    ).toBeGreaterThan(0);
  });
});
