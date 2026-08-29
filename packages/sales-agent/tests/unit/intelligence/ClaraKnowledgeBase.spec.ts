import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import {
  CLARA_KNOWLEDGE,
  ClaraKnowledgeBase,
} from "../../../src/intelligence/ClaraKnowledgeBase.js";

describe("ClaraKnowledgeBase", () => {
  it("branch() returns the branch's name and area for all 4 branches", () => {
    expect(ClaraKnowledgeBase.branch(BranchId.BINTARO).name).toBe("Mobix Bintaro");
    expect(ClaraKnowledgeBase.branch(BranchId.CINERE).name).toBe("Mobix Cinere");
    expect(ClaraKnowledgeBase.branch(BranchId.UMUM).name).toBe("Mobix Pondok Bambu");
    expect(ClaraKnowledgeBase.branch(BranchId.BANDUNG).name).toBe("Mobix Bandung");
  });

  it("findObjectionHandler() matches a known objection key case-insensitively", () => {
    expect(ClaraKnowledgeBase.findObjectionHandler("KAYAKNYA MAHAL")).toBeDefined();
  });

  it("findObjectionHandler() returns undefined for an unknown objection", () => {
    expect(ClaraKnowledgeBase.findObjectionHandler("apa kabar")).toBeUndefined();
  });

  it("CLARA_KNOWLEDGE exposes the brand identity", () => {
    expect(CLARA_KNOWLEDGE.brand).toBe("Mobix by DSS Motor");
    expect(CLARA_KNOWLEDGE.slogan).toBe("Xtra Aman, Xtra Yakin");
    expect(CLARA_KNOWLEDGE.paymentOptions).toContain("Kredit Syariah");
  });
});
