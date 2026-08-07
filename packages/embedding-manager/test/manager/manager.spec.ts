import { describe, expect, it } from "vitest";

import { EmbeddingNotFoundException } from "../../src/errors/embedding-not-found-exception.js";
import { EmbeddingManagerLedger } from "../../src/manager/embedding-manager-ledger.js";
import { EmbeddingRegistry } from "../../src/registry/embedding-registry.js";
import { EmbeddingSession } from "../../src/session/embedding-session.js";
import { executionFixture } from "../helpers/execution-fixture.js";

function makeLedger() {
  return new EmbeddingManagerLedger(new EmbeddingRegistry(), new EmbeddingSession());
}

describe("EmbeddingManagerLedger", () => {
  it("register() stores the execution and records statistics", () => {
    const ledger = makeLedger();
    const execution = executionFixture();
    ledger.register(execution.instance.token, execution, {
      id: execution.metadata.embeddingId,
      token: execution.instance.token,
      metadata: execution.metadata,
    });
    expect(ledger.get(execution.instance.token)).toBe(execution);
    expect(ledger.statistics.get(execution.request.providerType).requestedCount).toBe(1);
  });

  it("get() returns undefined for an unknown token", () => {
    expect(makeLedger().get("missing")).toBeUndefined();
  });

  it("require() throws for an unknown token", () => {
    expect(() => makeLedger().require("missing")).toThrow(EmbeddingNotFoundException);
  });

  it("update() replaces the stored execution", () => {
    const ledger = makeLedger();
    const execution = executionFixture();
    ledger.register(execution.instance.token, execution, {
      id: execution.metadata.embeddingId,
      token: execution.instance.token,
      metadata: execution.metadata,
    });
    const updated = { ...execution, metadata: { ...execution.metadata, title: "Updated" } };
    ledger.update(execution.instance.token, updated);
    expect(ledger.get(execution.instance.token)?.metadata.title).toBe("Updated");
  });

  it("update() throws for an unknown token", () => {
    const ledger = makeLedger();
    expect(() => ledger.update("missing", executionFixture())).toThrow(EmbeddingNotFoundException);
  });

  it("unregister() removes a known token and returns true", () => {
    const ledger = makeLedger();
    const execution = executionFixture();
    ledger.register(execution.instance.token, execution, {
      id: execution.metadata.embeddingId,
      token: execution.instance.token,
      metadata: execution.metadata,
    });
    expect(ledger.unregister(execution.instance.token)).toBe(true);
    expect(ledger.get(execution.instance.token)).toBeUndefined();
  });

  it("unregister() returns false for an unknown token", () => {
    expect(makeLedger().unregister("missing")).toBe(false);
  });

  it("list()/count() reflect the registered executions", () => {
    const ledger = makeLedger();
    const execution = executionFixture();
    ledger.register(execution.instance.token, execution, {
      id: execution.metadata.embeddingId,
      token: execution.instance.token,
      metadata: execution.metadata,
    });
    expect(ledger.list()).toHaveLength(1);
    expect(ledger.count()).toBe(1);
  });

  it("registerJob()/getJob() round-trip", () => {
    const ledger = makeLedger();
    const job = {
      id: "j-1",
      jobId: "j-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      priority: 5,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    ledger.registerJob(job);
    expect(ledger.getJob("j-1")).toEqual(job);
  });

  it("requireJob() throws for an unknown jobId", () => {
    expect(() => makeLedger().requireJob("missing")).toThrow(EmbeddingNotFoundException);
  });

  it("updateJob() replaces a registered job", () => {
    const ledger = makeLedger();
    const job = {
      id: "j-1",
      jobId: "j-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      priority: 5,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    ledger.registerJob(job);
    const updated = ledger.updateJob({ ...job, completedAt: "2026-01-02T00:00:00.000Z" });
    expect(updated.completedAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("listJobs() returns all registered jobs", () => {
    const ledger = makeLedger();
    ledger.registerJob({
      id: "j-1",
      jobId: "j-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      priority: 5,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(ledger.listJobs()).toHaveLength(1);
  });
});
