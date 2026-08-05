import { describe, expect, it } from "vitest";

import {
  labelsSchema,
  tagsSchema,
  workflowMetadataSchema,
} from "../../src/metadata/workflow-metadata.js";

describe("Labels/Tags/Metadata", () => {
  it("labelsSchema accepts valid lowercase keys", () => {
    expect(labelsSchema.safeParse({ team: "platform", "env.stage": "prod" }).success).toBe(true);
  });

  it("labelsSchema rejects an invalid key", () => {
    expect(labelsSchema.safeParse({ "Not Valid": "x" }).success).toBe(false);
  });

  it("tagsSchema accepts a list of non-empty strings", () => {
    expect(tagsSchema.safeParse(["a", "b"]).success).toBe(true);
  });

  it("tagsSchema rejects an empty string entry", () => {
    expect(tagsSchema.safeParse([""]).success).toBe(false);
  });

  it("workflowMetadataSchema accepts an arbitrary bag", () => {
    expect(workflowMetadataSchema.safeParse({ a: 1, b: "two", c: [1, 2] }).success).toBe(true);
  });
});
