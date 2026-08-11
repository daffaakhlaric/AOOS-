import { Branch, Funnel } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { AdAngle } from "../../../src/domain/value-objects/AdAngle.js";
import {
  ANGLE_USP_MAP,
  BusinessKnowledgeBase,
  KNOWN_EVERGREEN_PATTERNS,
  KNOWN_FATIGUE_PATTERNS,
  KNOWN_PERFORMANCE_BASELINES,
  MOBIX_BRAND,
  MOBIX_LOCATIONS,
  TOP_UNITS,
} from "../../../src/intelligence/BusinessKnowledgeBase.js";

describe("MOBIX_BRAND", () => {
  it("has the correct brand identity fields", () => {
    expect(MOBIX_BRAND.brandName).toBe("Mobix");
    expect(MOBIX_BRAND.slogan).toBe("Xtra Aman, Xtra Yakin");
    expect(MOBIX_BRAND.website).toBe("https://mobixbydss.id");
  });

  it("has the correct USPs", () => {
    expect(MOBIX_BRAND.usps).toContain("Inspeksi 150+ titik pemeriksaan");
    expect(MOBIX_BRAND.usps).toContain("Verifikasi independen oleh Otospector");
    expect(MOBIX_BRAND.usps).toHaveLength(5);
  });

  it("has three payment options including syariah", () => {
    expect(MOBIX_BRAND.paymentOptions).toHaveLength(3);
    expect(MOBIX_BRAND.paymentOptions.some((p) => p.type === "KREDIT_SYARIAH")).toBe(true);
  });
});

describe("ANGLE_USP_MAP", () => {
  it("has an entry for every AdAngle member (total map, including the WEBSITE_REDIRECT addition)", () => {
    for (const angle of Object.values(AdAngle)) {
      expect(ANGLE_USP_MAP[angle]).toBeDefined();
      expect(ANGLE_USP_MAP[angle].length).toBeGreaterThan(0);
    }
  });

  it("returns the correct USP messages for DP_RINGAN", () => {
    expect(ANGLE_USP_MAP[AdAngle.DP_RINGAN]).toContain("DP mulai 10 juta sudah bisa bawa pulang");
  });

  it("returns the correct USP messages for KREDIT_SYARIAH", () => {
    expect(ANGLE_USP_MAP[AdAngle.KREDIT_SYARIAH]).toContain(
      "Pembiayaan syariah tersedia — halal, bebas riba",
    );
  });
});

describe("TOP_UNITS", () => {
  it("has the correct best angles for Xpander", () => {
    const xpander = TOP_UNITS.find((u) => u.model === "Xpander");
    expect(xpander?.bestAngles).toEqual([AdAngle.GUDANGNYA, AdAngle.DP_RINGAN, AdAngle.QNA]);
  });

  it("has the correct best angles for Brio", () => {
    const brio = TOP_UNITS.find((u) => u.model === "Brio");
    expect(brio?.bestAngles).toEqual([
      AdAngle.DP_RINGAN,
      AdAngle.KREDIT_SYARIAH,
      AdAngle.DISCOVERY,
    ]);
  });

  it("includes Stargazer with a note about needing an angle refresh in Bandung", () => {
    const stargazer = TOP_UNITS.find((u) => u.model === "Stargazer");
    expect(stargazer?.branches).toContain(Branch.BANDUNG);
    expect(stargazer?.note).toContain("angle refresh");
  });

  it("has 6 top units", () => {
    expect(TOP_UNITS).toHaveLength(6);
  });
});

describe("MOBIX_LOCATIONS", () => {
  it("has the correct MAAO Rp/lead + sample size data for Bintaro and Cinere", () => {
    const bintaro = MOBIX_LOCATIONS.find((l) => l.branch === Branch.BINTARO);
    const cinere = MOBIX_LOCATIONS.find((l) => l.branch === Branch.CINERE);
    expect(bintaro).toMatchObject({ avgRphLead: 7059, sampleSize: 219, bestFunnel: Funnel.CTWA });
    expect(cinere).toMatchObject({ avgRphLead: 6919, sampleSize: 227, bestFunnel: Funnel.CTWA });
  });

  it("flags Bandung as needing a creative + funnel overhaul (high Rp/lead)", () => {
    const bandung = MOBIX_LOCATIONS.find((l) => l.branch === Branch.BANDUNG);
    expect(bandung?.avgRphLead).toBe(42_621);
    expect(bandung?.note).toContain("overhaul");
  });

  it("maps the spec's Pondok Bambu entry onto the real Branch.UMUM (no Branch.PONDOK_BAMBU exists)", () => {
    const pondokBambu = MOBIX_LOCATIONS.find((l) => l.fullName === "Mobix Pondok Bambu");
    expect(pondokBambu?.branch).toBe(Branch.UMUM);
    expect(pondokBambu?.sampleSize).toBe(0);
  });

  it("has 4 locations", () => {
    expect(MOBIX_LOCATIONS).toHaveLength(4);
  });
});

describe("BusinessKnowledgeBase.loadMobixKnowledge()", () => {
  it("bundles brand + locations + angleUsps + topUnits", () => {
    const knowledge = BusinessKnowledgeBase.loadMobixKnowledge();
    expect(knowledge.brand).toBe(MOBIX_BRAND);
    expect(knowledge.locations).toBe(MOBIX_LOCATIONS);
    expect(knowledge.angleUsps).toBe(ANGLE_USP_MAP);
    expect(knowledge.topUnits).toBe(TOP_UNITS);
  });
});

describe("KNOWN_PERFORMANCE_BASELINES (S1 seed, from MAAO 2 July 2026)", () => {
  it("maps the spec's Branch.BOOST_ORGANIK entry onto the real Branch.BOOST", () => {
    const boost = KNOWN_PERFORMANCE_BASELINES.find(
      (b) => b.funnel === Funnel.BRAND_BOOST && b.branch === Branch.BOOST,
    );
    expect(boost).toMatchObject({ avgRphLead: 6499, sampleSize: 2037 });
  });

  it("has 5 seed baselines", () => {
    expect(KNOWN_PERFORMANCE_BASELINES).toHaveLength(5);
  });
});

describe("KNOWN_EVERGREEN_PATTERNS", () => {
  it("marks DP_RINGAN, KREDIT_SYARIAH, GUDANGNYA as top performers", () => {
    const topPerformers = KNOWN_EVERGREEN_PATTERNS.filter((p) => p.topPerformer).map(
      (p) => p.angle,
    );
    expect(topPerformers.sort()).toEqual(
      [AdAngle.DP_RINGAN, AdAngle.KREDIT_SYARIAH, AdAngle.GUDANGNYA].sort(),
    );
  });

  it("includes the WEBSITE_REDIRECT angle with a short healthy-days window", () => {
    const websiteRedirect = KNOWN_EVERGREEN_PATTERNS.find(
      (p) => p.angle === AdAngle.WEBSITE_REDIRECT,
    );
    expect(websiteRedirect?.avgDaysHealthy).toBe(7);
    expect(websiteRedirect?.topPerformer).toBe(false);
  });
});

describe("KNOWN_FATIGUE_PATTERNS", () => {
  it("has the correct avg-days-to-fatigue per funnel", () => {
    expect(KNOWN_FATIGUE_PATTERNS.get(Funnel.CTWA)).toBe(28);
    expect(KNOWN_FATIGUE_PATTERNS.get(Funnel.BRAND_BOOST)).toBe(21);
    expect(KNOWN_FATIGUE_PATTERNS.get(Funnel.DM)).toBe(35);
    expect(KNOWN_FATIGUE_PATTERNS.get(Funnel.WEBSITE_LEAD)).toBe(14);
  });
});
