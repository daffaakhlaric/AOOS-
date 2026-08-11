import { describe, expect, it, vi } from "vitest";

import { WebhookParser } from "../../../src/infrastructure/webhook/WebhookParser.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const FIXED_NOW = new Date("2026-02-15T10:00:00.000Z");

function ctwaPayload() {
  return JSON.stringify({
    object: "page",
    entry: [
      {
        id: "entry-1",
        changes: [
          {
            field: "ctwa_message",
            value: { ad_id: "ad-123", waba_id: "waba-1", phone_number: "+6281234567890" },
          },
        ],
      },
    ],
  });
}

function formPayload() {
  return JSON.stringify({
    object: "page",
    entry: [
      {
        id: "entry-2",
        changes: [
          {
            field: "leadgen",
            value: {
              ad_id: "ad-456",
              form_id: "form-1",
              leadgen_id: "lead-1",
              created_time: 1700000000,
            },
          },
        ],
      },
    ],
  });
}

describe("WebhookParser", () => {
  const parser = new WebhookParser({ now: () => FIXED_NOW });

  it("parses a CTWA lead payload", () => {
    const leads = unwrap(parser.parse(ctwaPayload()));
    expect(leads).toHaveLength(1);
    expect(leads[0]?.change.field).toBe("ctwa_message");
    expect(leads[0]?.receivedAt).toEqual(FIXED_NOW);
    expect(leads[0]?.publisherObject).toBe("page");
  });

  it("parses a Form lead payload", () => {
    const leads = unwrap(parser.parse(formPayload()));
    expect(leads).toHaveLength(1);
    expect(leads[0]?.change.field).toBe("leadgen");
  });

  it("parses multiple entries and multiple changes into a flat array", () => {
    const payload = JSON.stringify({
      object: "page",
      entry: [
        {
          id: "e1",
          changes: [
            { field: "ctwa_message", value: { ad_id: "a1", waba_id: "w1", phone_number: "+1" } },
          ],
        },
        {
          id: "e2",
          changes: [
            {
              field: "leadgen",
              value: { ad_id: "a2", form_id: "f1", leadgen_id: "l1", created_time: 1 },
            },
            { field: "ctwa_message", value: { ad_id: "a3", waba_id: "w2", phone_number: "+2" } },
          ],
        },
      ],
    });
    const leads = unwrap(parser.parse(payload));
    expect(leads).toHaveLength(3);
  });

  it("returns an empty array for a payload with 0 entries", () => {
    const leads = unwrap(parser.parse(JSON.stringify({ object: "page", entry: [] })));
    expect(leads).toEqual([]);
  });

  it("returns an empty array for an entry with no changes field", () => {
    const leads = unwrap(parser.parse(JSON.stringify({ object: "page", entry: [{ id: "e1" }] })));
    expect(leads).toEqual([]);
  });

  it("returns an empty array for an entry with an empty changes array", () => {
    const leads = unwrap(
      parser.parse(JSON.stringify({ object: "page", entry: [{ id: "e1", changes: [] }] })),
    );
    expect(leads).toEqual([]);
  });

  it("rejects a body that is not valid JSON", () => {
    expect(unwrapErr(parser.parse("{not json")).message).toMatch(/not valid JSON/);
  });

  it("rejects a payload missing the required 'object' field", () => {
    expect(parser.parse(JSON.stringify({ entry: [] })).ok).toBe(false);
  });

  it("rejects a payload with a malformed change (unknown field discriminator)", () => {
    const payload = JSON.stringify({
      object: "page",
      entry: [{ id: "e1", changes: [{ field: "unknown_field", value: {} }] }],
    });
    expect(unwrapErr(parser.parse(payload)).message).toMatch(/schema validation/);
  });

  it("rejects a leadgen change missing required value fields", () => {
    const payload = JSON.stringify({
      object: "page",
      entry: [{ id: "e1", changes: [{ field: "leadgen", value: { ad_id: "a1" } }] }],
    });
    expect(parser.parse(payload).ok).toBe(false);
  });

  it('labels a root-level schema validation issue as "(root)" (empty issue path)', () => {
    // A top-level JSON value that isn't an object at all (here, a bare array) fails Zod's
    // top-level object check with an issue whose `path` is empty — exercising the `|| "(root)"`
    // fallback, as opposed to every other rejection test here, all of which fail on a named field.
    const err = unwrapErr(parser.parse(JSON.stringify([])));
    expect(err.message).toMatch(/schema validation/);
    expect(
      (err.context?.issues as string[] | undefined)?.some((issue) => issue.startsWith("(root):")),
    ).toBe(true);
  });

  it("stringifies a non-Error thrown value when JSON.parse fails in an unusual way", () => {
    // JSON.parse always throws a real SyntaxError in practice, but the code defensively handles
    // any thrown value via `cause instanceof Error ? cause.message : String(cause)` — this test
    // exercises that `String(cause)` fallback branch directly.
    const spy = vi.spyOn(JSON, "parse").mockImplementationOnce(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw "raw non-error throw";
    });
    try {
      const err = unwrapErr(parser.parse("irrelevant"));
      expect(err.message).toMatch(/raw non-error throw/);
    } finally {
      spy.mockRestore();
    }
  });

  it("defaults `now` to the real wall clock when not injected", () => {
    const defaultParser = new WebhookParser();
    const leads = unwrap(defaultParser.parse(ctwaPayload()));
    expect(leads[0]?.receivedAt).toBeInstanceOf(Date);
  });
});
