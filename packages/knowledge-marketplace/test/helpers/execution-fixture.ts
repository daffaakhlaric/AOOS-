import type { KnowledgeMarketplaceExecution } from "../../src/domain/knowledge-marketplace-execution.js";
import { MarketplacePackageStatus } from "../../src/domain/marketplace-package-status.js";

import { contextFixture } from "./context-fixture.js";
import { metadataFixture } from "./metadata-fixture.js";
import { packageFixture } from "./package-fixture.js";

export function executionFixture(
  overrides: Partial<KnowledgeMarketplaceExecution> = {},
): KnowledgeMarketplaceExecution {
  const context = overrides.context ?? contextFixture();
  const metadata = overrides.metadata ?? metadataFixture();
  const pkg = overrides.package ?? packageFixture();
  const now = "2026-01-01T00:00:00.000Z";
  return {
    instance: {
      id: "instance-1",
      token: context.token,
      listingId: metadata.listingId,
      packageId: metadata.packageId,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      state: MarketplacePackageStatus.DRAFT,
      createdAt: now,
      updatedAt: now,
      ...overrides.instance,
    },
    context,
    metadata,
    package: pkg,
    dependencies: overrides.dependencies ?? [],
    compatibility: overrides.compatibility,
    certification: overrides.certification,
    installation: overrides.installation,
    history: overrides.history ?? [],
    trace: overrides.trace,
    auditTrail: overrides.auditTrail ?? [],
    logs: overrides.logs ?? [],
  };
}
