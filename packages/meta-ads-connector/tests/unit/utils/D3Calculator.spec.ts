import { describe, expect, it } from "vitest";

import type { MetaAction } from "../../../src/types/MetaApiTypes.js";
import { calculateActionBreakdown } from "../../../src/utils/D3Calculator.js";

const D3 = "onsite_conversion.messaging_conversation_started_7d";
const CONV = "onsite_conversion.total_messaging_connection";
const LEAD = "onsite_conversion.lead";

describe("calculateActionBreakdown", () => {
  it("extracts d3, conversations, and leadForm from a well-formed actions array", () => {
    const actions: MetaAction[] = [
      { action_type: D3, value: "10" },
      { action_type: CONV, value: "12" },
      { action_type: LEAD, value: "3" },
    ];
    expect(calculateActionBreakdown(actions, undefined)).toEqual({
      conversations: 12,
      d3: 10,
      leadForm: 3,
    });
  });

  it("returns all zeros for undefined actions and no fallback", () => {
    expect(calculateActionBreakdown(undefined, undefined)).toEqual({
      conversations: 0,
      d3: 0,
      leadForm: 0,
    });
  });

  it("returns all zeros for an empty actions array", () => {
    expect(calculateActionBreakdown([], undefined)).toEqual({
      conversations: 0,
      d3: 0,
      leadForm: 0,
    });
  });

  it("ignores unrecognized action_type values", () => {
    const actions: MetaAction[] = [{ action_type: "link_click", value: "999" }];
    expect(calculateActionBreakdown(actions, undefined)).toEqual({
      conversations: 0,
      d3: 0,
      leadForm: 0,
    });
  });

  it("sums multiple rows of the same action_type", () => {
    const actions: MetaAction[] = [
      { action_type: D3, value: "5" },
      { action_type: D3, value: "7" },
    ];
    expect(calculateActionBreakdown(actions, undefined).d3).toBe(12);
  });

  it("skips a non-array actions value", () => {
    expect(calculateActionBreakdown("not-an-array" as unknown as MetaAction[], undefined)).toEqual({
      conversations: 0,
      d3: 0,
      leadForm: 0,
    });
  });

  it("skips a null entry within the array", () => {
    const actions = [null, { action_type: D3, value: "5" }] as unknown as MetaAction[];
    expect(calculateActionBreakdown(actions, undefined).d3).toBe(5);
  });

  it("skips an entry missing action_type", () => {
    const actions = [{ value: "5" }, { action_type: D3, value: "5" }] as unknown as MetaAction[];
    expect(calculateActionBreakdown(actions, undefined).d3).toBe(5);
  });

  it("skips an entry missing value", () => {
    const actions = [
      { action_type: D3 },
      { action_type: D3, value: "5" },
    ] as unknown as MetaAction[];
    expect(calculateActionBreakdown(actions, undefined).d3).toBe(5);
  });

  it("skips an entry whose value does not parse to a finite number", () => {
    const actions: MetaAction[] = [
      { action_type: D3, value: "not-a-number" },
      { action_type: D3, value: "5" },
    ];
    expect(calculateActionBreakdown(actions, undefined).d3).toBe(5);
  });

  it("uses messaging_conversation_started as a fallback when no CONV action row is present", () => {
    const actions: MetaAction[] = [{ action_type: D3, value: "5" }];
    expect(calculateActionBreakdown(actions, "18").conversations).toBe(18);
  });

  it("prefers the CONV action row over the messaging_conversation_started fallback", () => {
    const actions: MetaAction[] = [{ action_type: CONV, value: "12" }];
    expect(calculateActionBreakdown(actions, "999").conversations).toBe(12);
  });

  it("ignores a non-numeric messaging_conversation_started fallback", () => {
    expect(calculateActionBreakdown(undefined, "not-a-number").conversations).toBe(0);
  });

  it("does not use the fallback when actions is undefined but messaging_conversation_started is present", () => {
    expect(calculateActionBreakdown(undefined, "7").conversations).toBe(7);
  });
});
