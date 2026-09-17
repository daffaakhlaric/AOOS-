import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { MetricSnapshotRepository } from "./infrastructure/metric-snapshot.repository.js";
import { MetricSnapshotController } from "./metric-snapshot.controller.js";
import { MetricSnapshotModule } from "./metric-snapshot.module.js";
import { MetricSnapshotService } from "./metric-snapshot.service.js";

describe("MetricSnapshotModule", () => {
  it("registers MetricSnapshotController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", MetricSnapshotModule) as unknown[];
    expect(metadata).toEqual([MetricSnapshotController]);
  });

  it("registers MetricSnapshotService, ApiKeyGuard, and a MetricSnapshotRepository factory as providers", () => {
    const metadata = Reflect.getMetadata("providers", MetricSnapshotModule) as Array<
      { provide?: unknown } | unknown
    >;
    expect(metadata).toHaveLength(3);
    expect(metadata).toContain(MetricSnapshotService);
    expect(metadata).toContain(ApiKeyGuard);
    const repoProvider = metadata.find(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        "provide" in p &&
        p.provide === MetricSnapshotRepository,
    );
    expect(repoProvider).toBeDefined();
  });

  it("exports MetricSnapshotService", () => {
    const exportsMetadata = Reflect.getMetadata("exports", MetricSnapshotModule) as unknown[];
    expect(exportsMetadata).toEqual([MetricSnapshotService]);
  });
});
