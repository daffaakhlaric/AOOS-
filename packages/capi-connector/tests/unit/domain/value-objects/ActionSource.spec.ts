import { describe, expect, it } from "vitest";

import { ActionSource } from "../../../../src/domain/value-objects/ActionSource.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("ActionSource", () => {
  it("website() always returns 'website'", () => {
    expect(ActionSource.website().toString()).toBe("website");
  });

  it("create('website') succeeds", () => {
    const actionSource = unwrap(ActionSource.create("website"));
    expect(actionSource.toString()).toBe("website");
  });

  it("rejects any value other than 'website'", () => {
    const error = unwrapErr(ActionSource.create("app"));
    expect(error.message).toContain('ActionSource must be "website"');
  });
});
