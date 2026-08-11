import { describe, expect, it } from "vitest";

import { Funnel } from "../../../src/domain/value-objects/Funnel.js";
import { classifyFunnel } from "../../../src/utils/FunnelClassifier.js";

describe("classifyFunnel", () => {
  it("classifies a name containing 'CTWA' as CTWA", () => {
    expect(classifyFunnel("CTWA - Cinere - Test Drive")).toBe(Funnel.CTWA);
  });

  it("classifies a name containing 'DM' as DM", () => {
    expect(classifyFunnel("DM - Bintaro - Promo")).toBe(Funnel.DM);
  });

  it("classifies a name containing 'Engagement' as DM", () => {
    expect(classifyFunnel("Engagement Campaign - Bandung")).toBe(Funnel.DM);
  });

  it("classifies a name containing 'Website' as WEBSITE_LEAD", () => {
    expect(classifyFunnel("Website Leads - Multi Branch")).toBe(Funnel.WEBSITE_LEAD);
  });

  it("classifies a name containing 'Boost' as BRAND_BOOST", () => {
    expect(classifyFunnel("Boost Post - Umum")).toBe(Funnel.BRAND_BOOST);
  });

  it("classifies a name containing 'Post:' as BRAND_BOOST", () => {
    expect(classifyFunnel("Post: New Arrival")).toBe(Funnel.BRAND_BOOST);
  });

  it("classifies an unrecognized name as BRAND_BOOST (otherwise fallback)", () => {
    expect(classifyFunnel("Random Campaign Name")).toBe(Funnel.BRAND_BOOST);
  });

  it("is case-sensitive — lowercase 'ctwa' does NOT match rule 1", () => {
    expect(classifyFunnel("ctwa campaign")).toBe(Funnel.BRAND_BOOST);
  });

  it("is case-sensitive — lowercase 'dm' does NOT match rule 2", () => {
    expect(classifyFunnel("dm campaign")).toBe(Funnel.BRAND_BOOST);
  });

  it("first-match-wins: CTWA takes precedence over Website when both substrings are present", () => {
    expect(classifyFunnel("CTWA Website Combo")).toBe(Funnel.CTWA);
  });

  it("first-match-wins: DM takes precedence over Boost when both substrings are present", () => {
    expect(classifyFunnel("DM Boost Combo")).toBe(Funnel.DM);
  });

  it("classifies an empty string as BRAND_BOOST", () => {
    expect(classifyFunnel("")).toBe(Funnel.BRAND_BOOST);
  });
});
