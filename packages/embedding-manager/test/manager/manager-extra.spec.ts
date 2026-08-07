import { describe, expect, it } from "vitest";

import { EmbeddingManagerLedger } from "../../src/manager/embedding-manager-ledger.js";
import { EmbeddingRegistry } from "../../src/registry/embedding-registry.js";
import { EmbeddingSession } from "../../src/session/embedding-session.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("EmbeddingManagerLedger — extra scenarios", () => {
  it("statistics accumulate per registration by providerType", () => {
    const ledger = new EmbeddingManagerLedger(new EmbeddingRegistry(), new EmbeddingSession());
    const a = executionFixture({
      instance: { ...executionFixture().instance, token: "t-a", embeddingId: "e-a", id: "e-a" },
    });
    const b = executionFixture({
      instance: { ...executionFixture().instance, token: "t-b", embeddingId: "e-b", id: "e-b" },
    });
    ledger.register("t-a", a, { id: "e-a", token: "t-a", metadata: a.metadata });
    ledger.register("t-b", b, { id: "e-b", token: "t-b", metadata: b.metadata });
    expect(ledger.statistics.get(a.request.providerType).requestedCount).toBe(2);
  });

  it("exposes the shared Registry and Session instances passed to its constructor", () => {
    const registry = new EmbeddingRegistry();
    const session = new EmbeddingSession();
    const ledger = new EmbeddingManagerLedger(registry, session);
    expect(ledger.registry).toBe(registry);
    expect(ledger.session).toBe(session);
  });

  it("count() is 0 for a freshly constructed ledger", () => {
    expect(
      new EmbeddingManagerLedger(new EmbeddingRegistry(), new EmbeddingSession()).count(),
    ).toBe(0);
  });

  it("updateJob() throws for a job never registered", () => {
    const ledger = new EmbeddingManagerLedger(new EmbeddingRegistry(), new EmbeddingSession());
    expect(() =>
      ledger.updateJob({
        id: "missing",
        jobId: "missing",
        embeddingId: "e-1",
        tenantId: "tenant-1",
        priority: 5,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });
});
