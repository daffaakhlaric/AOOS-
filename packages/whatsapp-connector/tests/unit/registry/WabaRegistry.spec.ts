import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { WabaAccount } from "../../../src/domain/entities/WabaAccount.js";
import { WabaNotFoundError } from "../../../src/domain/errors/index.js";
import { PhoneNumber } from "../../../src/domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../../../src/domain/value-objects/PhoneNumberId.js";
import { WabaId } from "../../../src/domain/value-objects/WabaId.js";
import { WabaRegistry } from "../../../src/registry/WabaRegistry.js";
import { WABA_ACCOUNTS_FIXTURE } from "../../fixtures/waFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function toAccount(config: (typeof WABA_ACCOUNTS_FIXTURE)[number]): WabaAccount {
  return unwrap(
    WabaAccount.create({
      id: unwrap(WabaId.create(config.wabaId)),
      phoneNumberId: unwrap(PhoneNumberId.create(config.phoneNumberId)),
      phoneNumber: unwrap(PhoneNumber.create(config.phoneNumber)),
      branch: config.branch,
      displayName: config.displayName,
      status: "ACTIVE",
      registeredAt: new Date(),
    }),
  );
}

describe("WabaRegistry", () => {
  it("registers all 4 branches and looks each up by phoneNumberId and by branch", () => {
    const registry = new WabaRegistry();
    const accounts = WABA_ACCOUNTS_FIXTURE.map(toAccount);

    for (const account of accounts) {
      registry.register(account);
    }

    expect(registry.listAll()).toHaveLength(4);

    for (const account of accounts) {
      const byPhone = unwrap(registry.getByPhoneNumberId(account.phoneNumberId));
      expect(byPhone.displayName).toBe(account.displayName);

      const byBranch = unwrap(registry.getByBranch(account.branch));
      expect(byBranch.phoneNumberId.equals(account.phoneNumberId)).toBe(true);
    }
  });

  it("returns WabaNotFoundError for an unknown phoneNumberId", () => {
    const registry = new WabaRegistry();
    const error = unwrapErr(
      registry.getByPhoneNumberId(unwrap(PhoneNumberId.create("unknown-id"))),
    );
    expect(error).toBeInstanceOf(WabaNotFoundError);
  });

  it("returns WabaNotFoundError for an unregistered branch", () => {
    const registry = new WabaRegistry();
    const error = unwrapErr(registry.getByBranch(Branch.MULTI));
    expect(error).toBeInstanceOf(WabaNotFoundError);
  });

  it("listAll returns an empty array for a fresh registry", () => {
    const registry = new WabaRegistry();
    expect(registry.listAll()).toEqual([]);
  });

  it("re-registering the same phoneNumberId overwrites the previous account", () => {
    const registry = new WabaRegistry();
    const account = toAccount(WABA_ACCOUNTS_FIXTURE[0]!);
    registry.register(account);
    const renamed = unwrap(
      WabaAccount.create({
        id: account.id,
        phoneNumberId: account.phoneNumberId,
        phoneNumber: account.phoneNumber,
        branch: account.branch,
        displayName: "Renamed",
        status: "ACTIVE",
        registeredAt: new Date(),
      }),
    );
    registry.register(renamed);
    expect(registry.listAll()).toHaveLength(1);
    expect(unwrap(registry.getByPhoneNumberId(account.phoneNumberId)).displayName).toBe("Renamed");
  });
});
