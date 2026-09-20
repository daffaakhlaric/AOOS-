import { describe, expect, it } from "vitest";

import { KieWebhookBodySchema } from "./kie-webhook.dto.js";

describe("KieWebhookBodySchema", () => {
  it("accepts a real Kie AI job-status-shaped body with a real taskId", () => {
    const parsed = KieWebhookBodySchema.safeParse({
      code: 200,
      msg: "success",
      data: {
        taskId: "task_veo_1765178608584",
        successFlag: 1,
        videoUrl: "https://cdn.kie.ai/v.mp4",
      },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.data.taskId).toBe("task_veo_1765178608584");
    }
  });

  it("accepts a minimal body carrying only data.taskId", () => {
    const parsed = KieWebhookBodySchema.safeParse({ data: { taskId: "task_1" } });
    expect(parsed.success).toBe(true);
  });

  it("rejects a body with no data at all", () => {
    const parsed = KieWebhookBodySchema.safeParse({ code: 200, msg: "success" });
    expect(parsed.success).toBe(false);
  });

  it("rejects a body whose data has no taskId", () => {
    const parsed = KieWebhookBodySchema.safeParse({ data: { successFlag: 1 } });
    expect(parsed.success).toBe(false);
  });

  it("rejects a body whose taskId is an empty string", () => {
    const parsed = KieWebhookBodySchema.safeParse({ data: { taskId: "" } });
    expect(parsed.success).toBe(false);
  });

  it("rejects a body whose taskId is not a string", () => {
    const parsed = KieWebhookBodySchema.safeParse({ data: { taskId: 12345 } });
    expect(parsed.success).toBe(false);
  });

  it("rejects a completely malformed body (null)", () => {
    const parsed = KieWebhookBodySchema.safeParse(null);
    expect(parsed.success).toBe(false);
  });

  it("rejects a completely malformed body (array)", () => {
    const parsed = KieWebhookBodySchema.safeParse([]);
    expect(parsed.success).toBe(false);
  });

  it("tolerates unrecognized extra fields Kie AI might add later (passthrough)", () => {
    const parsed = KieWebhookBodySchema.safeParse({
      data: { taskId: "task_1", someNewField: "x" },
      anotherNewTopLevelField: 123,
    });
    expect(parsed.success).toBe(true);
  });
});
