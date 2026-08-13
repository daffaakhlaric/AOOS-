import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { CreativeBrief } from "../../../../src/domain/entities/CreativeBrief.js";
import { AdAngle } from "../../../../src/domain/value-objects/AdAngle.js";
import { CreativeBriefId } from "../../../../src/domain/value-objects/CreativeBriefId.js";
import { TargetPersona } from "../../../../src/domain/value-objects/TargetPersona.js";

function baseProps() {
  return {
    id: CreativeBriefId.generate(),
    adId: "ad-1",
    unit: "Xpander Cross 2019",
    branch: Branch.BINTARO,
    angle: AdAngle.DP_RINGAN,
    targetPersona: TargetPersona.PRIMARY_FAMILY,
    primaryMessage: "DP mulai 20 juta",
    tone: "casual",
    avoid: ["terlalu banyak text"],
    formats: ["VIDEO_15S" as const],
    reason: "frequency 4.9x",
    urgency: "HIGH" as const,
    estimatedImpactIfRefreshed: "target -40% Rp/D3",
    createdAt: new Date("2026-08-09T00:00:00.000Z"),
  };
}

describe("CreativeBrief", () => {
  it("creates a valid brief", () => {
    const result = CreativeBrief.create(baseProps());
    expect(result.ok).toBe(true);
  });

  it("rejects an empty adId", () => {
    expect(CreativeBrief.create({ ...baseProps(), adId: "" }).ok).toBe(false);
  });

  it("rejects an empty unit", () => {
    expect(CreativeBrief.create({ ...baseProps(), unit: "" }).ok).toBe(false);
  });

  it("rejects an invalid branch", () => {
    expect(CreativeBrief.create({ ...baseProps(), branch: "BOGUS" as never }).ok).toBe(false);
  });

  it("rejects an invalid angle", () => {
    expect(CreativeBrief.create({ ...baseProps(), angle: "BOGUS" as never }).ok).toBe(false);
  });

  it("rejects an invalid targetPersona", () => {
    expect(CreativeBrief.create({ ...baseProps(), targetPersona: "BOGUS" as never }).ok).toBe(
      false,
    );
  });

  it("rejects an empty primaryMessage", () => {
    expect(CreativeBrief.create({ ...baseProps(), primaryMessage: "" }).ok).toBe(false);
  });

  it("rejects empty formats", () => {
    expect(CreativeBrief.create({ ...baseProps(), formats: [] }).ok).toBe(false);
  });

  it("rejects an empty reason", () => {
    expect(CreativeBrief.create({ ...baseProps(), reason: "" }).ok).toBe(false);
  });

  it("exposes every getter, including optional referenceAdId", () => {
    const props = { ...baseProps(), referenceAdId: "ad-99" };
    const result = CreativeBrief.create(props);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const brief = result.value;
    expect(brief.adId).toBe("ad-1");
    expect(brief.unit).toBe("Xpander Cross 2019");
    expect(brief.branch).toBe(Branch.BINTARO);
    expect(brief.angle).toBe(AdAngle.DP_RINGAN);
    expect(brief.targetPersona).toBe(TargetPersona.PRIMARY_FAMILY);
    expect(brief.primaryMessage).toBe("DP mulai 20 juta");
    expect(brief.tone).toBe("casual");
    expect(brief.avoid).toEqual(["terlalu banyak text"]);
    expect(brief.formats).toEqual(["VIDEO_15S"]);
    expect(brief.referenceAdId).toBe("ad-99");
    expect(brief.reason).toBe("frequency 4.9x");
    expect(brief.urgency).toBe("HIGH");
    expect(brief.estimatedImpactIfRefreshed).toBe("target -40% Rp/D3");
    expect(brief.createdAt).toEqual(props.createdAt);
  });

  it("referenceAdId is undefined when not provided", () => {
    const brief = CreativeBrief.create(baseProps());
    expect(brief.ok && brief.value.referenceAdId).toBeUndefined();
  });

  // AAOS-W1D-S3, coordinator note correction #7: callToAction/destinationType/wabaPhoneNumber
  // are new, purely additive optional fields on CreativeBriefProps.
  it("exposes callToAction/destinationType/wabaPhoneNumber when provided (AAOS-W1D-S3)", () => {
    const props = {
      ...baseProps(),
      callToAction: "SEND_WHATSAPP_MESSAGE",
      destinationType: "WHATSAPP",
      wabaPhoneNumber: "+6281100000001",
    };
    const result = CreativeBrief.create(props);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.callToAction).toBe("SEND_WHATSAPP_MESSAGE");
    expect(result.ok && result.value.destinationType).toBe("WHATSAPP");
    expect(result.ok && result.value.wabaPhoneNumber).toBe("+6281100000001");
  });

  it("callToAction/destinationType/wabaPhoneNumber are undefined when not provided — purely additive, no breaking change for existing callers (AAOS-W1D-S3)", () => {
    const result = CreativeBrief.create(baseProps());
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.callToAction).toBeUndefined();
    expect(result.ok && result.value.destinationType).toBeUndefined();
    expect(result.ok && result.value.wabaPhoneNumber).toBeUndefined();
  });
});
