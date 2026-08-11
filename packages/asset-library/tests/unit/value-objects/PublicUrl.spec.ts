import { describe, expect, it } from "vitest";

import { PublicUrl } from "../../../src/domain/value-objects/PublicUrl.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("PublicUrl", () => {
  it("create() accepts a valid http(s) URL", () => {
    const url = unwrap(
      PublicUrl.create(
        "https://example.supabase.co/storage/v1/object/public/mobix-assets/brand/logo.png",
      ),
    );
    expect(url.toString()).toContain("logo.png");
  });

  it("create() rejects an empty string", () => {
    const error = unwrapErr(PublicUrl.create(""));
    expect(error.message).toContain("PublicUrl");
  });

  it("create() rejects a malformed URL", () => {
    const error = unwrapErr(PublicUrl.create("not a url"));
    expect(error.message).toContain("PublicUrl");
  });

  it("create() rejects a non-http(s) protocol", () => {
    const error = unwrapErr(PublicUrl.create("ftp://example.com/file.png"));
    expect(error.message).toContain("http(s)");
  });

  it("equals() compares by value", () => {
    const a = unwrap(PublicUrl.create("https://example.com/a.png"));
    const b = unwrap(PublicUrl.create("https://example.com/a.png"));
    const c = unwrap(PublicUrl.create("https://example.com/b.png"));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
