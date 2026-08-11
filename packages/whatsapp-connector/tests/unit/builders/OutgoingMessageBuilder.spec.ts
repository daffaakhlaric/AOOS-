import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { OutgoingMessageBuilder } from "../../../src/builders/OutgoingMessageBuilder.js";
import { MessageType } from "../../../src/domain/value-objects/MessageType.js";
import { PhoneNumber } from "../../../src/domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../../../src/domain/value-objects/PhoneNumberId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const TO = unwrap(PhoneNumber.create("+628123456789"));
const FROM = unwrap(PhoneNumberId.create("100000000000001"));

describe("OutgoingMessageBuilder", () => {
  it("builds a valid text message + sendInput", () => {
    const built = unwrap(
      new OutgoingMessageBuilder()
        .withTo(TO)
        .withFrom(FROM)
        .withBranch(Branch.BINTARO)
        .withAccessToken("token")
        .withBody("Halo kak")
        .build(),
    );
    expect(built.message.type).toBe(MessageType.TEXT);
    expect(built.message.body.toString()).toBe("Halo kak");
    expect(built.sendInput).toEqual({
      phoneNumberId: FROM.toString(),
      accessToken: "token",
      to: TO.toString(),
      body: "Halo kak",
      previewUrl: false,
    });
  });

  it("respects withPreviewUrl(true)", () => {
    const built = unwrap(
      new OutgoingMessageBuilder()
        .withTo(TO)
        .withFrom(FROM)
        .withBranch(Branch.BINTARO)
        .withAccessToken("token")
        .withBody("link")
        .withPreviewUrl(true)
        .build(),
    );
    expect(built.sendInput.previewUrl).toBe(true);
  });

  it("rejects when to/from/branch are missing", () => {
    const error = unwrapErr(
      new OutgoingMessageBuilder().withAccessToken("token").withBody("hi").build(),
    );
    expect(error.message).toContain("to, from, and branch");
  });

  it("rejects an empty accessToken", () => {
    const error = unwrapErr(
      new OutgoingMessageBuilder()
        .withTo(TO)
        .withFrom(FROM)
        .withBranch(Branch.BINTARO)
        .withBody("hi")
        .build(),
    );
    expect(error.message).toContain("accessToken");
  });

  it("rejects when body is missing", () => {
    const error = unwrapErr(
      new OutgoingMessageBuilder()
        .withTo(TO)
        .withFrom(FROM)
        .withBranch(Branch.BINTARO)
        .withAccessToken("token")
        .build(),
    );
    expect(error.message).toContain("body");
  });

  it("rejects a body exceeding 4096 characters", () => {
    const error = unwrapErr(
      new OutgoingMessageBuilder()
        .withTo(TO)
        .withFrom(FROM)
        .withBranch(Branch.BINTARO)
        .withAccessToken("token")
        .withBody("a".repeat(4097))
        .build(),
    );
    expect(error).toBeDefined();
  });
});
