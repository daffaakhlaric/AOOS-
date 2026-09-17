import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CreativeMemoryController } from "./creative-memory.controller.js";
import { CreativeMemoryModule } from "./creative-memory.module.js";
import { CreativeMemoryService } from "./creative-memory.service.js";
import { CreativeMemoryRepository } from "./infrastructure/creative-memory.repository.js";

describe("CreativeMemoryModule", () => {
  it("registers CreativeMemoryController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", CreativeMemoryModule) as unknown[];
    expect(metadata).toEqual([CreativeMemoryController]);
  });

  it("registers CreativeMemoryService, ApiKeyGuard, and a CreativeMemoryRepository factory as providers", () => {
    const metadata = Reflect.getMetadata("providers", CreativeMemoryModule) as Array<
      { provide?: unknown } | unknown
    >;
    expect(metadata).toHaveLength(3);
    expect(metadata).toContain(CreativeMemoryService);
    expect(metadata).toContain(ApiKeyGuard);
    const repoProvider = metadata.find(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        "provide" in p &&
        p.provide === CreativeMemoryRepository,
    );
    expect(repoProvider).toBeDefined();
  });

  it("exports CreativeMemoryService", () => {
    const exportsMetadata = Reflect.getMetadata("exports", CreativeMemoryModule) as unknown[];
    expect(exportsMetadata).toEqual([CreativeMemoryService]);
  });
});
