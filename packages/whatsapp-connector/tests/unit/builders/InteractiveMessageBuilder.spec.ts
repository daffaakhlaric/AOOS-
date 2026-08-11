import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { InteractiveMessageBuilder } from "../../../src/builders/InteractiveMessageBuilder.js";
import { MessageType } from "../../../src/domain/value-objects/MessageType.js";
import { PhoneNumber } from "../../../src/domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../../../src/domain/value-objects/PhoneNumberId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const TO = unwrap(PhoneNumber.create("+628123456789"));
const FROM = unwrap(PhoneNumberId.create("100000000000001"));
const BUTTONS = [
  { id: "yes", title: "Ya, lanjut" },
  { id: "later", title: "Nanti dulu" },
];

describe("InteractiveMessageBuilder", () => {
  it("builds a valid interactive button message + sendInput", () => {
    const built = unwrap(
      new InteractiveMessageBuilder()
        .withTo(TO)
        .withFrom(FROM)
        .withBranch(Branch.BINTARO)
        .withAccessToken("token")
        .withBody("Mau lanjut diskusi soal Xpander?")
        .withButtons(BUTTONS)
        .build(),
    );
    expect(built.message.type).toBe(MessageType.INTERACTIVE);
    expect(built.sendInput.buttons).toEqual(BUTTONS);
  });

  it("rejects when to/from/branch are missing", () => {
    const error = unwrapErr(
      new InteractiveMessageBuilder()
        .withAccessToken("token")
        .withBody("x")
        .withButtons(BUTTONS)
        .build(),
    );
    expect(error.message).toContain("to, from, and branch");
  });

  it("rejects an empty accessToken", () => {
    const error = unwrapErr(
      new InteractiveMessageBuilder()
        .withTo(TO)
        .withFrom(FROM)
        .withBranch(Branch.BINTARO)
        .withBody("x")
        .withButtons(BUTTONS)
        .build(),
    );
    expect(error.message).toContain("accessToken");
  });

  it("rejects a missing body", () => {
    const error = unwrapErr(
      new InteractiveMessageBuilder()
        .withTo(TO)
        .withFrom(FROM)
        .withBranch(Branch.BINTARO)
        .withAccessToken("token")
        .withButtons(BUTTONS)
        .build(),
    );
    expect(error.message).toContain("body");
  });

  it("rejects a body exceeding 4096 characters", () => {
    const error = unwrapErr(
      new InteractiveMessageBuilder()
        .withTo(TO)
        .withFrom(FROM)
        .withBranch(Branch.BINTARO)
        .withAccessToken("token")
        .withBody("a".repeat(4097))
        .withButtons(BUTTONS)
        .build(),
    );
    expect(error).toBeDefined();
  });

  it("rejects zero buttons", () => {
    const error = unwrapErr(
      new InteractiveMessageBuilder()
        .withTo(TO)
        .withFrom(FROM)
        .withBranch(Branch.BINTARO)
        .withAccessToken("token")
        .withBody("x")
        .build(),
    );
    expect(error.message).toContain("at least one button");
  });

  it("rejects more than 3 buttons", () => {
    const error = unwrapErr(
      new InteractiveMessageBuilder()
        .withTo(TO)
        .withFrom(FROM)
        .withBranch(Branch.BINTARO)
        .withAccessToken("token")
        .withBody("x")
        .withButtons([
          { id: "1", title: "One" },
          { id: "2", title: "Two" },
          { id: "3", title: "Three" },
          { id: "4", title: "Four" },
        ])
        .build(),
    );
    expect(error.message).toContain("at most 3 buttons");
  });
});
