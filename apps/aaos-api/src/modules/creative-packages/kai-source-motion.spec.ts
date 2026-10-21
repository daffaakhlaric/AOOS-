import type { AssetLibrary } from "@aos/asset-library";
import type { CreativeConnectorBundle } from "@aos/creative-connector";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import type { LlmService } from "../llm/llm.service.js";

import {
  prepareProduction,
  type ProductionJob,
  type ProductionPlan,
} from "./domain/kai-production.js";
import type { StructuredCreativeBrief } from "./domain/structured-creative-brief.js";
import { KaiProductionMediaService } from "./kai-production-media.service.js";

const claim = {
  text: "Rumah BSD",
  sourceId: "listing",
  sourceLocator: "title",
  sourceType: "LISTING" as const,
};
const brief = { factualClaims: [claim], CTA: { label: "Hubungi kami" } } as StructuredCreativeBrief;
const plan: ProductionPlan = {
  format: "VIDEO",
  durationSeconds: 2,
  scenes: [
    {
      id: "7edc942f-c9ed-47bc-8de4-ce7ff9217e7d",
      ordinal: 0,
      sourceUrl: "https://assets.example/source.jpg",
      visualDirection: "Preserve source",
      overlayText: claim.text,
      provenance: claim,
      startSeconds: 0,
      endSeconds: 2,
    },
  ],
};

describe("source-preserving video production", () => {
  it("renders only one unit for a sample even when multiple scenes and ratios are requested", () => {
    const sample: ProductionPlan = {
      ...plan,
      renderMode: "SAMPLE",
      durationSeconds: 4,
      scenes: [plan.scenes[0]!, { ...plan.scenes[0]!, ordinal: 1, startSeconds: 2, endSeconds: 4 }],
    };
    const output = prepareProduction(sample, brief, ["9:16", "4:5"], [plan.scenes[0]!.sourceUrl]);
    expect(output.units).toHaveLength(1);
    expect(output.units[0]).toMatchObject({ sceneIndex: 0, ratio: "9:16", durationSeconds: 2 });
  });
  it("defaults to real-source motion for all four output ratios", () => {
    const output = prepareProduction(
      plan,
      brief,
      ["9:16", "4:5", "1:1", "16:9"],
      [plan.scenes[0]!.sourceUrl],
    );
    expect(output.units).toHaveLength(4);
    expect(output.units.every((u) => u.productionMethod === "SOURCE_MOTION" && !u.taskId)).toBe(
      true,
    );
  });
  it("retains explicit AI scene choice and rejects unsupported provider ratios", () => {
    const ai = {
      ...plan,
      scenes: plan.scenes.map((s) => ({ ...s, productionMethod: "IMAGE_TO_VIDEO" as const })),
    };
    expect(
      prepareProduction(ai, brief, ["9:16"], [plan.scenes[0]!.sourceUrl]).units[0]
        ?.productionMethod,
    ).toBe("IMAGE_TO_VIDEO");
    expect(() => prepareProduction(ai, brief, ["4:5"], [plan.scenes[0]!.sourceUrl])).toThrow(
      "UNSUPPORTED_GENERATIVE_RATIO",
    );
  });
  it("rejects changed source ownership and unsupported factual copy", () => {
    expect(() => prepareProduction(plan, brief, ["4:5"], [])).toThrow("SOURCE_PHOTO_CHANGED");
    expect(() =>
      prepareProduction(
        { ...plan, scenes: plan.scenes.map((s) => ({ ...s, overlayText: "Guaranteed ROI" })) },
        brief,
        ["4:5"],
        [plan.scenes[0]!.sourceUrl],
      ),
    ).toThrow("UNSOURCED_STORYBOARD_CLAIM");
  });
  it("renders a playable timed 4:5 clip and persists poster plus video without KIE", async () => {
    const source = await sharp({
      create: { width: 900, height: 700, channels: 3, background: "#395943" },
    })
      .jpeg()
      .toBuffer();
    const stored: Buffer[] = [];
    const library = {
      assetStorage: {
        upload: async (input: { fileBody: Buffer; path: string }) => {
          stored.push(input.fileBody);
          return { ok: true, value: { publicUrl: `https://assets.example/${input.path}` } };
        },
      },
    } as unknown as AssetLibrary;
    // No generation service exists in this mock: a paid provider call would fail the test.
    const connector = {
      downloadMedia: { execute: async () => ({ ok: true, value: source }) },
    } as unknown as CreativeConnectorBundle;
    const media = new KaiProductionMediaService(library, connector, {} as LlmService);
    const output = prepareProduction(plan, brief, ["4:5"], [plan.scenes[0]!.sourceUrl]);
    const job = { id: "job-test", tenant_id: "tenant-test", output } as ProductionJob;
    const asset = await media.renderSourceMotion(job, output.units[0]!, brief);
    expect(asset.width / asset.height).toBe(0.8);
    expect(asset.durationSeconds).toBeCloseTo(2, 1);
    expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(asset.taskId).toBe("source-motion:job-test:0");
    expect(stored).toHaveLength(2);
    expect(stored[0]!.subarray(4, 8).toString()).toBe("ftyp");
    expect(asset.previewUrl).toContain("qa.jpg");
  }, 30000);
});
