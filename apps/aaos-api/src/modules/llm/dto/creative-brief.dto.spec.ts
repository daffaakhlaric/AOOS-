import { describe, expect, it } from "vitest";

import { CreativeBriefLlmPayloadSchema, CreativeBriefRequestSchema } from "./creative-brief.dto.js";

describe("CreativeBriefRequestSchema", () => {
  it("accepts a minimal valid request", () => {
    const result = CreativeBriefRequestSchema.safeParse({
      ad: { name: "Xpander Ultimate" },
      branch: "BINTARO",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an optional angle hint and ad metrics", () => {
    const result = CreativeBriefRequestSchema.safeParse({
      ad: { name: "Brio Satya", branch: "CINERE", metrics: { spend: 1000000, frequency: 4.8 } },
      angle: "DP_RINGAN",
      branch: "CINERE",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid angle hint not in the real AdAngle enum", () => {
    const result = CreativeBriefRequestSchema.safeParse({
      ad: { name: "Xpander" },
      angle: "MADE_UP_ANGLE",
      branch: "BINTARO",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid branch not in the real Branch enum", () => {
    const result = CreativeBriefRequestSchema.safeParse({
      ad: { name: "Xpander" },
      branch: "JAKARTA_PUSAT",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a request missing the ad field", () => {
    const result = CreativeBriefRequestSchema.safeParse({ branch: "BINTARO" });
    expect(result.success).toBe(false);
  });
});

describe("CreativeBriefLlmPayloadSchema", () => {
  const validPayload = {
    unit: "Xpander Ultimate",
    angle: "DP_RINGAN",
    branch: "BINTARO",
    primaryMessage: "DP mulai 20 juta langsung bisa bawa pulang",
    tone: "casual, relatable",
    formats: ["VIDEO_15S", "IMAGE_SQUARE"],
    avoid: ["terlalu banyak text"],
    urgency: "HIGH",
  };

  it("accepts a well-formed LLM creative-brief payload", () => {
    const result = CreativeBriefLlmPayloadSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects a hallucinated angle not in the real AdAngle enum (fail closed)", () => {
    const result = CreativeBriefLlmPayloadSchema.safeParse({
      ...validPayload,
      angle: "SUPER_DUPER_ANGLE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a hallucinated branch not in the real Branch enum (fail closed)", () => {
    const result = CreativeBriefLlmPayloadSchema.safeParse({ ...validPayload, branch: "SURABAYA" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid format not in the real CreativeFormat union", () => {
    const result = CreativeBriefLlmPayloadSchema.safeParse({
      ...validPayload,
      formats: ["GIF_ANIMATED"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid urgency not in HIGH/MEDIUM/LOW", () => {
    const result = CreativeBriefLlmPayloadSchema.safeParse({ ...validPayload, urgency: "EXTREME" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty formats array", () => {
    const result = CreativeBriefLlmPayloadSchema.safeParse({ ...validPayload, formats: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a missing primaryMessage", () => {
    const { primaryMessage: _primaryMessage, ...withoutMessage } = validPayload;
    const result = CreativeBriefLlmPayloadSchema.safeParse(withoutMessage);
    expect(result.success).toBe(false);
  });
});
