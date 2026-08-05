import { describe, expect, it } from "vitest";

import { withSessionState } from "../../src/engine/execution-session.js";
import { sessionFixture } from "../helpers/session-fixture.js";

describe("Engine Test — withSessionState", () => {
  it("replaces only the fields present in the patch, keeping the rest (and definition always)", () => {
    const { session } = sessionFixture();
    const patched = withSessionState(session, { history: [] });
    expect(patched.definition).toBe(session.definition);
    expect(patched.context).toBe(session.context);
    expect(patched.cursor).toBe(session.cursor);
    expect(patched.history).toEqual([]);
    expect(patched.statistics).toBe(session.statistics);
  });

  it("returns the original field values when the patch is empty", () => {
    const { session } = sessionFixture();
    const patched = withSessionState(session, {});
    expect(patched).toEqual(session);
  });
});
