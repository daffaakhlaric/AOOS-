import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { WabaAccount } from "../../../src/domain/entities/WabaAccount.js";
import { PhoneNumber } from "../../../src/domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../../../src/domain/value-objects/PhoneNumberId.js";
import { WabaId } from "../../../src/domain/value-objects/WabaId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function validProps() {
  return {
    id: unwrap(WabaId.create("waba-1")),
    phoneNumberId: unwrap(PhoneNumberId.create("100000000000001")),
    phoneNumber: unwrap(PhoneNumber.create("+628110000001")),
    branch: Branch.BINTARO,
    displayName: "Mobix Bintaro",
    status: "ACTIVE" as const,
    registeredAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

describe("WabaAccount", () => {
  it("creates with valid props and exposes all getters", () => {
    const props = validProps();
    const account = unwrap(WabaAccount.create(props));
    expect(account.id.equals(props.id)).toBe(true);
    expect(account.phoneNumberId.equals(props.phoneNumberId)).toBe(true);
    expect(account.phoneNumber.equals(props.phoneNumber)).toBe(true);
    expect(account.branch).toBe(Branch.BINTARO);
    expect(account.displayName).toBe("Mobix Bintaro");
    expect(account.status).toBe("ACTIVE");
    expect(account.registeredAt).toEqual(props.registeredAt);
  });

  it("rejects an empty displayName", () => {
    const error = unwrapErr(WabaAccount.create({ ...validProps(), displayName: "" }));
    expect(error.message).toContain("displayName");
  });

  it("rejects an invalid status", () => {
    const error = unwrapErr(
      WabaAccount.create({ ...validProps(), status: "BOGUS" as unknown as "ACTIVE" }),
    );
    expect(error.message).toContain("status");
  });

  it("accepts INACTIVE status", () => {
    const account = unwrap(WabaAccount.create({ ...validProps(), status: "INACTIVE" }));
    expect(account.status).toBe("INACTIVE");
  });
});
