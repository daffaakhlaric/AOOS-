import { describe, expect, it } from "vitest";

import { KieApiResponseMapper } from "../../../src/infrastructure/kie-api/KieApiResponseMapper.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("KieApiResponseMapper", () => {
  describe("mapUploadResponse", () => {
    it("maps a successful upload response", () => {
      const data = unwrap(
        KieApiResponseMapper.mapUploadResponse({
          success: true,
          code: 200,
          msg: "File upload successful",
          data: { fileId: "file_abc1234", fileUrl: "https://cdn.kie.ai/x.jpg" },
        }),
      );
      expect(data).toEqual({ fileId: "file_abc1234", fileUrl: "https://cdn.kie.ai/x.jpg" });
    });

    it("returns an error when success is false", () => {
      const error = unwrapErr(
        KieApiResponseMapper.mapUploadResponse({ success: false, code: 500, msg: "boom" }),
      );
      expect(error.message).toMatch(/boom/);
    });

    it("returns an error when the body fails schema validation", () => {
      const error = unwrapErr(KieApiResponseMapper.mapUploadResponse({ not: "valid" }));
      expect(error.message).toMatch(/schema validation/);
    });
  });

  describe("mapTaskCreatedResponse", () => {
    it("maps a successful task-created response", () => {
      const data = unwrap(
        KieApiResponseMapper.mapTaskCreatedResponse({
          code: 200,
          msg: "success",
          data: { taskId: "task_veo_1" },
        }),
      );
      expect(data.taskId).toBe("task_veo_1");
    });

    it("returns an error when code is not 200", () => {
      const error = unwrapErr(
        KieApiResponseMapper.mapTaskCreatedResponse({ code: 500, msg: "server error" }),
      );
      expect(error.message).toMatch(/server error/);
    });

    it("returns an error when data is missing despite code 200", () => {
      const error = unwrapErr(KieApiResponseMapper.mapTaskCreatedResponse({ code: 200 }));
      expect(error.message).toMatch(/unknown error/);
    });

    it("returns an error when the body fails schema validation", () => {
      const error = unwrapErr(KieApiResponseMapper.mapTaskCreatedResponse("not an object"));
      expect(error.message).toMatch(/schema validation/);
    });
  });

  describe("mapTaskStatusResponse", () => {
    it("maps a pending status response", () => {
      const data = unwrap(
        KieApiResponseMapper.mapTaskStatusResponse({
          code: 200,
          data: { taskId: "task_1", successFlag: 0 },
        }),
      );
      expect(data.successFlag).toBe(0);
    });

    it("maps a successful video status response", () => {
      const data = unwrap(
        KieApiResponseMapper.mapTaskStatusResponse({
          code: 200,
          data: { taskId: "task_1", successFlag: 1, videoUrl: "https://cdn.kie.ai/v.mp4" },
        }),
      );
      expect(data.videoUrl).toBe("https://cdn.kie.ai/v.mp4");
    });

    it("maps a successful image status response with an images array", () => {
      const data = unwrap(
        KieApiResponseMapper.mapTaskStatusResponse({
          code: 200,
          data: {
            taskId: "task_1",
            successFlag: 1,
            imageUrl: "https://cdn.kie.ai/i1.jpg",
            images: ["https://cdn.kie.ai/i1.jpg", "https://cdn.kie.ai/i2.jpg"],
          },
        }),
      );
      expect(data.images).toHaveLength(2);
    });

    it("returns an error when code is not 200", () => {
      const error = unwrapErr(
        KieApiResponseMapper.mapTaskStatusResponse({ code: 404, msg: "not found" }),
      );
      expect(error.message).toMatch(/not found/);
    });

    it("returns an error when code is 200 but data is missing", () => {
      const error = unwrapErr(KieApiResponseMapper.mapTaskStatusResponse({ code: 200 }));
      expect(error.message).toMatch(/unknown error/);
    });

    it("returns an error when the body fails schema validation", () => {
      const error = unwrapErr(KieApiResponseMapper.mapTaskStatusResponse(null));
      expect(error.message).toMatch(/schema validation/);
    });
  });
});
