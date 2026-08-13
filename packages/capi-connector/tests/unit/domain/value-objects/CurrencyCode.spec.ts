import { describe, expect, it } from "vitest";

import { CurrencyCode } from "../../../../src/domain/value-objects/CurrencyCode.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("CurrencyCode", () => {
  it("idr() always returns 'IDR'", () => {
    expect(CurrencyCode.idr().toString()).toBe("IDR");
  });

  it("create('IDR') succeeds", () => {
    const currency = unwrap(CurrencyCode.create("IDR"));
    expect(currency.toString()).toBe("IDR");
  });

  it("rejects any currency other than IDR", () => {
    const error = unwrapErr(CurrencyCode.create("USD"));
    expect(error.message).toContain('CurrencyCode must be "IDR"');
  });
});
