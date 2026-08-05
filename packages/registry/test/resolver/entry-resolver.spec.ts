import type { IsoDateTime, Uuid } from "@aos/types";
import { describe, expect, it } from "vitest";

import { EntryStatus } from "../../src/contracts/entry-status.js";
import { RegistryKind } from "../../src/contracts/registry-kind.js";
import { TenantScope } from "../../src/contracts/tenant-scope.js";
import type { RegistryEntry } from "../../src/entities/registry-entry.js";
import { EntryResolver } from "../../src/resolver/entry-resolver.js";

function entry(version: string): RegistryEntry {
  return {
    entryId: `entry-${version}` as Uuid<"RegistryEntryId">,
    registryKind: RegistryKind.TOOL,
    manifest: { id: "kie", version, category: "media" },
    status: EntryStatus.ACTIVE,
    tenantScope: TenantScope.GLOBAL,
    owner: "team",
    createdAt: new Date().toISOString() as IsoDateTime,
    updatedAt: new Date().toISOString() as IsoDateTime,
    changelog: [version],
  };
}

describe("EntryResolver", () => {
  const versions = [entry("1.0.0"), entry("1.5.0"), entry("2.0.0")];
  const resolver = new EntryResolver(() => versions);
  const emptyResolver = new EntryResolver(() => []);

  it("returns undefined for an unknown id", () => {
    expect(emptyResolver.resolve("kie")).toBeUndefined();
  });

  it("resolves to the highest version when no reference is given", () => {
    expect(resolver.resolve("kie")?.manifest.version).toBe("2.0.0");
  });

  it('resolves "latest" to the highest version explicitly', () => {
    expect(resolver.resolve("kie", "latest")?.manifest.version).toBe("2.0.0");
  });

  it("resolves an exact version match", () => {
    expect(resolver.resolve("kie", "1.5.0")?.manifest.version).toBe("1.5.0");
  });

  it("resolves a SemVer range to the highest satisfying version", () => {
    expect(resolver.resolve("kie", "^1.0.0")?.manifest.version).toBe("1.5.0");
  });

  it("returns undefined when no version satisfies the range", () => {
    expect(resolver.resolve("kie", "^3.0.0")).toBeUndefined();
  });

  it("returns undefined for an invalid range string", () => {
    expect(resolver.resolve("kie", "not-a-range")).toBeUndefined();
  });
});
