import { describe, expect, it } from "vitest";

import { LeadStatus } from "../../../src/domain/value-objects/LeadStatus.js";
import { transitionLeadStatus } from "../../../src/domain/value-objects/LeadStatusTransition.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("transitionLeadStatus (design resolution #4)", () => {
  it("allows NEW -> COLD -> WARM -> HOT (pinned happy path, partial)", () => {
    expect(unwrap(transitionLeadStatus(LeadStatus.NEW, LeadStatus.COLD))).toBe(LeadStatus.COLD);
    expect(unwrap(transitionLeadStatus(LeadStatus.COLD, LeadStatus.WARM))).toBe(LeadStatus.WARM);
    expect(unwrap(transitionLeadStatus(LeadStatus.WARM, LeadStatus.HOT))).toBe(LeadStatus.HOT);
  });

  it("allows temperature to move backward too (free bidirectional)", () => {
    expect(unwrap(transitionLeadStatus(LeadStatus.HOT, LeadStatus.COLD))).toBe(LeadStatus.COLD);
  });

  it("allows a no-op transition among NEW/COLD/WARM/HOT", () => {
    expect(unwrap(transitionLeadStatus(LeadStatus.WARM, LeadStatus.WARM))).toBe(LeadStatus.WARM);
  });

  it("rejects a direct transition to ASSIGNED", () => {
    const error = unwrapErr(transitionLeadStatus(LeadStatus.HOT, LeadStatus.ASSIGNED));
    expect(error.message).toContain("RecordAssignment");
  });

  it("rejects a direct transition to CLOSED", () => {
    const error = unwrapErr(transitionLeadStatus(LeadStatus.HOT, LeadStatus.CLOSED));
    expect(error.message).toContain("RecordClosing");
  });

  it("rejects ANY transition from CLOSED (terminal)", () => {
    expect(unwrapErr(transitionLeadStatus(LeadStatus.CLOSED, LeadStatus.NEW)).message).toContain(
      "terminal",
    );
    expect(unwrapErr(transitionLeadStatus(LeadStatus.CLOSED, LeadStatus.COLD)).message).toContain(
      "terminal",
    );
    expect(unwrapErr(transitionLeadStatus(LeadStatus.CLOSED, LeadStatus.CLOSED)).message).toContain(
      "terminal",
    );
  });

  it("allows ASSIGNED to move back to a temperature bucket (assignment released)", () => {
    expect(unwrap(transitionLeadStatus(LeadStatus.ASSIGNED, LeadStatus.WARM))).toBe(
      LeadStatus.WARM,
    );
  });
});
