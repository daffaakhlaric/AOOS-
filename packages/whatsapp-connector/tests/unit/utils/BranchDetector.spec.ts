import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { WabaAccount } from "../../../src/domain/entities/WabaAccount.js";
import { PhoneNumber } from "../../../src/domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../../../src/domain/value-objects/PhoneNumberId.js";
import { WabaId } from "../../../src/domain/value-objects/WabaId.js";
import { WabaRegistry } from "../../../src/registry/WabaRegistry.js";
import { detectBranch } from "../../../src/utils/BranchDetector.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function makeAccount(phoneNumberId: string, branch: Branch) {
  return unwrap(
    WabaAccount.create({
      id: unwrap(WabaId.create(`waba-${branch}`)),
      phoneNumberId: unwrap(PhoneNumberId.create(phoneNumberId)),
      phoneNumber: unwrap(PhoneNumber.create("+628110000001")),
      branch,
      displayName: `Mobix ${branch}`,
      status: "ACTIVE",
      registeredAt: new Date(),
    }),
  );
}

describe("detectBranch", () => {
  it("resolves the branch for a registered phone_number_id", () => {
    const registry = new WabaRegistry();
    registry.register(makeAccount("100000000000001", Branch.CINERE));

    const branch = unwrap(detectBranch(registry, unwrap(PhoneNumberId.create("100000000000001"))));
    expect(branch).toBe(Branch.CINERE);
  });

  it("returns WabaNotFoundError for an unregistered phone_number_id", () => {
    const registry = new WabaRegistry();
    const error = unwrapErr(detectBranch(registry, unwrap(PhoneNumberId.create("does-not-exist"))));
    expect(error.message).toContain("does-not-exist");
  });
});
