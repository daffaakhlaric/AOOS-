import { describe, expect, it } from "vitest";

import { EmbeddingRecord } from "../../src/domain/embedding-record.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("EmbeddingRecord", () => {
  const execution = executionFixture();
  const record = new EmbeddingRecord(execution);

  it("id reflects the instance id", () => {
    expect(record.id).toBe(execution.instance.id);
  });

  it("token reflects the instance token", () => {
    expect(record.token).toBe(execution.instance.token);
  });

  it("embeddingId reflects the instance embeddingId", () => {
    expect(record.embeddingId).toBe(execution.instance.embeddingId);
  });

  it("state reflects the instance state", () => {
    expect(record.state).toBe(execution.instance.state);
  });

  it("metadata reflects the execution metadata", () => {
    expect(record.metadata).toBe(execution.metadata);
  });

  it("request reflects the execution request", () => {
    expect(record.request).toBe(execution.request);
  });

  it("context reflects the execution context", () => {
    expect(record.context).toBe(execution.context);
  });

  it("resolvedProvider is undefined when not resolved", () => {
    expect(record.resolvedProvider).toBeUndefined();
  });

  it("resolvedProvider reflects a resolved Provider", () => {
    const withProvider = new EmbeddingRecord(
      executionFixture({
        resolvedProvider: {
          id: "p-1",
          providerId: "p-1",
          name: "OpenAI",
          type: "openai" as never,
          tenantId: "tenant-1",
          active: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    );
    expect(withProvider.resolvedProvider?.providerId).toBe("p-1");
  });

  it("resolvedModel is undefined when not resolved", () => {
    expect(record.resolvedModel).toBeUndefined();
  });

  it("resolvedNamespace is undefined when not resolved", () => {
    expect(record.resolvedNamespace).toBeUndefined();
  });

  it("configuration is undefined when not present", () => {
    expect(record.configuration).toBeUndefined();
  });

  it("resultMetadata reflects the execution resultMetadata", () => {
    expect(record.resultMetadata).toBe(execution.resultMetadata);
  });

  it("history reflects the execution history", () => {
    expect(record.history).toBe(execution.history);
  });

  it("auditTrail reflects the execution auditTrail", () => {
    expect(record.auditTrail).toBe(execution.auditTrail);
  });

  it("logs reflects the execution logs", () => {
    expect(record.logs).toBe(execution.logs);
  });

  it("toExecution() returns the underlying execution", () => {
    expect(record.toExecution()).toBe(execution);
  });
});
