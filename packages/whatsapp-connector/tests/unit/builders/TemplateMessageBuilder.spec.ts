import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { TemplateMessageBuilder } from "../../../src/builders/TemplateMessageBuilder.js";
import { MessageType } from "../../../src/domain/value-objects/MessageType.js";
import { PhoneNumber } from "../../../src/domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../../../src/domain/value-objects/PhoneNumberId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const TO = unwrap(PhoneNumber.create("+628123456789"));
const FROM = unwrap(PhoneNumberId.create("100000000000001"));

describe("TemplateMessageBuilder", () => {
  it("builds a valid template message + sendInput with default language 'id'", () => {
    const built = unwrap(
      new TemplateMessageBuilder()
        .withTo(TO)
        .withFrom(FROM)
        .withBranch(Branch.BINTARO)
        .withAccessToken("token")
        .withTemplateName("hello_world")
        .withBodyParameters(["Budi"])
        .build(),
    );
    expect(built.message.type).toBe(MessageType.TEMPLATE);
    expect(built.message.body.toString()).toBe("hello_world(Budi)");
    expect(built.sendInput).toEqual({
      phoneNumberId: FROM.toString(),
      accessToken: "token",
      to: TO.toString(),
      templateName: "hello_world",
      languageCode: "id",
      bodyParameters: ["Budi"],
    });
  });

  it("respects an explicit languageCode", () => {
    const built = unwrap(
      new TemplateMessageBuilder()
        .withTo(TO)
        .withFrom(FROM)
        .withBranch(Branch.BINTARO)
        .withAccessToken("token")
        .withTemplateName("hello_world")
        .withLanguageCode("en_US")
        .build(),
    );
    expect(built.sendInput.languageCode).toBe("en_US");
  });

  it("defaults bodyParameters to an empty array", () => {
    const built = unwrap(
      new TemplateMessageBuilder()
        .withTo(TO)
        .withFrom(FROM)
        .withBranch(Branch.BINTARO)
        .withAccessToken("token")
        .withTemplateName("hello_world")
        .build(),
    );
    expect(built.sendInput.bodyParameters).toEqual([]);
    expect(built.message.body.toString()).toBe("hello_world()");
  });

  it("rejects when to/from/branch are missing", () => {
    const error = unwrapErr(
      new TemplateMessageBuilder().withAccessToken("token").withTemplateName("x").build(),
    );
    expect(error.message).toContain("to, from, and branch");
  });

  it("rejects an empty accessToken", () => {
    const error = unwrapErr(
      new TemplateMessageBuilder()
        .withTo(TO)
        .withFrom(FROM)
        .withBranch(Branch.BINTARO)
        .withTemplateName("x")
        .build(),
    );
    expect(error.message).toContain("accessToken");
  });

  it("rejects an empty templateName", () => {
    const error = unwrapErr(
      new TemplateMessageBuilder()
        .withTo(TO)
        .withFrom(FROM)
        .withBranch(Branch.BINTARO)
        .withAccessToken("token")
        .build(),
    );
    expect(error.message).toContain("templateName");
  });

  it("rejects when the rendered template body would exceed 4096 characters", () => {
    const error = unwrapErr(
      new TemplateMessageBuilder()
        .withTo(TO)
        .withFrom(FROM)
        .withBranch(Branch.BINTARO)
        .withAccessToken("token")
        .withTemplateName("hello_world")
        .withBodyParameters(["a".repeat(4097)])
        .build(),
    );
    expect(error).toBeDefined();
  });
});
