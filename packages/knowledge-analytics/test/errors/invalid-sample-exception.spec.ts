import { describe, expect, it } from "vitest";

import { InvalidSampleException } from "../../src/errors/invalid-sample-exception.js";
import { KnowledgeAnalyticsException } from "../../src/errors/knowledge-analytics-exception.js";

describe("InvalidSampleException", () => {
  it("is a KnowledgeAnalyticsException", () => {
    expect(new InvalidSampleException("bad")).toBeInstanceOf(KnowledgeAnalyticsException);
  });

  it("uses the INVALID_SAMPLE code", () => {
    expect(new InvalidSampleException("bad").code).toBe("INVALID_SAMPLE");
  });

  it("includes the reason in the message", () => {
    expect(new InvalidSampleException("bad value").message).toBe(
      "Invalid metric sample: bad value",
    );
  });

  it("stores the reason in context", () => {
    expect(new InvalidSampleException("bad value").context).toEqual({ reason: "bad value" });
  });
});
