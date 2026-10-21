import { describe, expect, it, vi } from "vitest";

import { KieAiGenerationClient } from "../../../src/infrastructure/kie-api/KieAiGenerationClient.js";
import { KieApiResponseMapper } from "../../../src/infrastructure/kie-api/KieApiResponseMapper.js";
describe("documented KIE record-info contracts", () => {
  it("reads Market state/resultJson image output", () => {
    const r = KieApiResponseMapper.mapTaskStatusResponse({
      code: 200,
      data: {
        taskId: "image1",
        state: "success",
        resultJson: JSON.stringify({ resultUrls: ["https://cdn.example/asset.png"] }),
      },
    });
    expect(r).toMatchObject({
      ok: true,
      value: {
        taskId: "image1",
        successFlag: 1,
        imageUrl: "https://cdn.example/asset.png",
        images: ["https://cdn.example/asset.png"],
      },
    });
  });
  it("maps Market pending and failure without fabricating outputs", () => {
    for (const [state, flag] of [
      ["waiting", 0],
      ["queuing", 0],
      ["generating", 0],
      ["fail", 3],
    ]) {
      expect(
        KieApiResponseMapper.mapTaskStatusResponse({ code: 200, data: { taskId: "id", state } }),
      ).toEqual({ ok: true, value: { taskId: "id", successFlag: flag } });
    }
  });
  it("reads Veo nested response resultUrls", () => {
    expect(
      KieApiResponseMapper.mapTaskStatusResponse({
        code: 200,
        data: {
          taskId: "video1",
          successFlag: 1,
          response: { resultUrls: ["https://cdn.example/asset.mp4"] },
        },
      }),
    ).toMatchObject({
      ok: true,
      value: { successFlag: 1, videoUrl: "https://cdn.example/asset.mp4" },
    });
  });
  it("rejects malformed result JSON and missing state", () => {
    expect(
      KieApiResponseMapper.mapTaskStatusResponse({
        code: 200,
        data: { taskId: "id", state: "success", resultJson: "broken" },
      }).ok,
    ).toBe(false);
    expect(
      KieApiResponseMapper.mapTaskStatusResponse({ code: 200, data: { taskId: "id" } }).ok,
    ).toBe(false);
  });
  it("uses Bearer auth and distinct encoded query endpoints", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ code: 200, data: { taskId: "id", successFlag: 0 } })),
      );
    const client = new KieAiGenerationClient({ apiKey: "test-key", fetchImpl });
    await client.getTaskStatus("a/b", "video");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.kie.ai/api/v1/veo/record-info?taskId=a%2Fb",
      expect.objectContaining({ headers: { Authorization: "Bearer test-key" } }),
    );
    fetchImpl.mockResolvedValue(
      new Response(JSON.stringify({ code: 200, data: { taskId: "id", state: "waiting" } })),
    );
    await client.getTaskStatus("a/b", "image");
    expect(fetchImpl).toHaveBeenLastCalledWith(
      "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=a%2Fb",
      expect.anything(),
    );
  });
});
