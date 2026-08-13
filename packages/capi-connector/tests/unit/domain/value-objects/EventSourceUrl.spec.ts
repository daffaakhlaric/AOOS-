import { describe, expect, it } from "vitest";

import { EventSourceUrl } from "../../../../src/domain/value-objects/EventSourceUrl.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("EventSourceUrl", () => {
  it("accepts the spec-pinned AAOS URL", () => {
    const url = unwrap(EventSourceUrl.create("https://mobixbydss.id"));
    expect(url.toString()).toBe("https://mobixbydss.id");
  });

  it("accepts any well-formed https:// URL", () => {
    expect(EventSourceUrl.create("https://example.com/path").ok).toBe(true);
  });

  it("rejects a non-https URL", () => {
    const error = unwrapErr(EventSourceUrl.create("http://mobixbydss.id"));
    expect(error.message).toContain("EventSourceUrl must be an https:// URL");
  });

  it("rejects an empty string", () => {
    expect(EventSourceUrl.create("").ok).toBe(false);
  });
});
