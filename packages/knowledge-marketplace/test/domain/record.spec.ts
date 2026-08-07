import { describe, expect, it } from "vitest";

import { KnowledgeMarketplaceRecord } from "../../src/domain/knowledge-marketplace-record.js";
import { certificationFixture } from "../helpers/certification-fixture.js";
import { compatibilityFixture } from "../helpers/compatibility-fixture.js";
import { dependencyFixture } from "../helpers/dependency-fixture.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgeMarketplaceRecord", () => {
  it("exposes every getter over the underlying execution", () => {
    const execution = executionFixture({
      dependencies: [dependencyFixture()],
      compatibility: compatibilityFixture(),
      certification: certificationFixture(),
      installation: {
        id: "install-1",
        listingId: "listing-1",
        instructions: "Follow the README.",
        requirements: [],
        recordedAt: "2026-01-01T00:00:00.000Z",
      },
      auditTrail: [
        {
          id: "audit-1",
          operation: "create_listing",
          listingId: "listing-1",
          tenantId: "tenant-1",
          occurredAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      logs: [
        {
          sequence: 0,
          level: "info",
          operation: "create_listing",
          message: "done",
          occurredAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const record = new KnowledgeMarketplaceRecord(execution);

    expect(record.id).toBe(execution.instance.id);
    expect(record.token).toBe(execution.instance.token);
    expect(record.listingId).toBe(execution.metadata.listingId);
    expect(record.packageId).toBe(execution.metadata.packageId);
    expect(record.state).toBe(execution.instance.state);
    expect(record.metadata).toBe(execution.metadata);
    expect(record.package).toBe(execution.package);
    expect(record.context).toBe(execution.context);
    expect(record.dependencies).toHaveLength(1);
    expect(record.compatibility).toBe(execution.compatibility);
    expect(record.certification).toBe(execution.certification);
    expect(record.installation).toBe(execution.installation);
    expect(record.history).toEqual(execution.history);
    expect(record.auditTrail).toHaveLength(1);
    expect(record.logs).toHaveLength(1);
    expect(record.toExecution()).toBe(execution);
  });

  it("leaves optional getters undefined when absent from the execution", () => {
    const execution = executionFixture();
    const record = new KnowledgeMarketplaceRecord(execution);

    expect(record.compatibility).toBeUndefined();
    expect(record.certification).toBeUndefined();
    expect(record.installation).toBeUndefined();
  });
});
