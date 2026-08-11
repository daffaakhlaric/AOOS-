import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import {
  JESSY_KNOWLEDGE,
  JessyKnowledgeBase,
} from "../../../src/intelligence/JessyKnowledgeBase.js";

describe("JessyKnowledgeBase", () => {
  it("branch() returns the branch's name and area for all 4 branches", () => {
    expect(JessyKnowledgeBase.branch(BranchId.BINTARO).name).toBe("Mobix Bintaro");
    expect(JessyKnowledgeBase.branch(BranchId.CINERE).name).toBe("Mobix Cinere");
    expect(JessyKnowledgeBase.branch(BranchId.UMUM).name).toBe("Mobix Pondok Bambu");
    expect(JessyKnowledgeBase.branch(BranchId.BANDUNG).name).toBe("Mobix Bandung");
  });

  it("findObjectionHandler() matches a known objection key case-insensitively", () => {
    expect(JessyKnowledgeBase.findObjectionHandler("KAYAKNYA MAHAL")).toBeDefined();
  });

  it("findObjectionHandler() returns undefined for an unknown objection", () => {
    expect(JessyKnowledgeBase.findObjectionHandler("apa kabar")).toBeUndefined();
  });

  it("JESSY_KNOWLEDGE exposes the brand identity", () => {
    expect(JESSY_KNOWLEDGE.brand).toBe("Mobix by DSS Motor");
    expect(JESSY_KNOWLEDGE.slogan).toBe("Xtra Aman, Xtra Yakin");
    expect(JESSY_KNOWLEDGE.paymentOptions).toContain("Kredit Syariah");
  });
});
