import type { IsoDateTime, Uuid } from "@aos/types";
import { describe, expect, it } from "vitest";

import { EntryStatus } from "../../src/contracts/entry-status.js";
import { RegistryKind } from "../../src/contracts/registry-kind.js";
import { TenantScope } from "../../src/contracts/tenant-scope.js";
import type { RegistryEntry } from "../../src/entities/registry-entry.js";
import { SearchIndex } from "../../src/search/search-index.js";

function entry(
  overrides: Partial<RegistryEntry["manifest"]> = {},
  entryId = crypto.randomUUID(),
): RegistryEntry {
  return {
    entryId: entryId as Uuid<"RegistryEntryId">,
    registryKind: RegistryKind.AGENT,
    manifest: {
      id: "content-manager",
      version: "1.0.0",
      name: "Content Manager",
      category: "marketing",
      capabilities: ["content_generation"],
      tags: ["marketing"],
      tenantId: "tenant-1",
      ...overrides,
    },
    status: EntryStatus.ACTIVE,
    tenantScope: TenantScope.GLOBAL,
    owner: "team",
    createdAt: new Date().toISOString() as IsoDateTime,
    updatedAt: new Date().toISOString() as IsoDateTime,
    changelog: ["1.0.0"],
  };
}

describe("Search Test — SearchIndex", () => {
  it("Find By ID", () => {
    const index = new SearchIndex();
    const e = entry();
    index.index(e);
    expect(index.search({ id: "content-manager" })).toEqual([e]);
    expect(index.search({ id: "missing" })).toEqual([]);
  });

  it("Find By Name (case-insensitive substring)", () => {
    const index = new SearchIndex();
    index.index(entry({ name: "Content Manager" }));
    expect(index.search({ name: "content" })).toHaveLength(1);
    expect(index.search({ name: "nonexistent" })).toHaveLength(0);
  });

  it("Find By Name falls back to id when no display name is set", () => {
    const index = new SearchIndex();
    index.index(entry({ name: undefined, id: "fallback-name" }));
    expect(index.search({ name: "fallback" })).toHaveLength(1);
  });

  it("Find By Tag", () => {
    const index = new SearchIndex();
    index.index(entry({ tags: ["marketing", "content"] }));
    expect(index.search({ tag: "marketing" })).toHaveLength(1);
    expect(index.search({ tag: "engineering" })).toHaveLength(0);
  });

  it("Find By Capability", () => {
    const index = new SearchIndex();
    index.index(entry({ capabilities: ["content_generation", "image_generation"] }));
    expect(index.search({ capability: "image_generation" })).toHaveLength(1);
  });

  it("Find By Category", () => {
    const index = new SearchIndex();
    index.index(entry({ category: "marketing" }));
    expect(index.search({ category: "marketing" })).toHaveLength(1);
    expect(index.search({ category: "sales" })).toHaveLength(0);
  });

  it("Find By Tenant", () => {
    const index = new SearchIndex();
    index.index(entry({ tenantId: "tenant-1" }));
    expect(index.search({ tenantId: "tenant-1" })).toHaveLength(1);
    expect(index.search({ tenantId: "tenant-2" })).toHaveLength(0);
  });

  it("Find By Version", () => {
    const index = new SearchIndex();
    index.index(entry({ version: "2.0.0" }));
    expect(index.search({ version: "2.0.0" })).toHaveLength(1);
    expect(index.search({ version: "1.0.0" })).toHaveLength(0);
  });

  it("combines multiple criteria with AND semantics", () => {
    const index = new SearchIndex();
    index.index(entry({ category: "marketing", capabilities: ["content_generation"] }, "entry-1"));
    index.index(entry({ category: "sales", capabilities: ["content_generation"] }, "entry-2"));
    expect(index.search({ category: "marketing", capability: "content_generation" })).toHaveLength(
      1,
    );
  });

  it("remove() takes an entry out of every future search result", () => {
    const index = new SearchIndex();
    const e = entry();
    index.index(e);
    index.remove(e.entryId);
    expect(index.search({ id: e.manifest.id })).toEqual([]);
  });

  it("clear() empties the index", () => {
    const index = new SearchIndex();
    index.index(entry());
    index.clear();
    expect(index.search({})).toEqual([]);
  });

  it("an empty criteria object matches every indexed entry", () => {
    const index = new SearchIndex();
    index.index(entry({}, "e1"));
    index.index(entry({ id: "other" }, "e2"));
    expect(index.search({})).toHaveLength(2);
  });

  it("Find By Namespace (005.3A Enhancement 9) — matches when a capability id shares the prefix", () => {
    const index = new SearchIndex();
    index.index(entry({ capabilities: ["inventory.read", "inventory.update"] }));
    expect(index.search({ namespace: "inventory" })).toHaveLength(1);
    expect(index.search({ namespace: "crm" })).toHaveLength(0);
  });

  it("Find By Industry (005.3A Enhancement 9)", () => {
    const index = new SearchIndex();
    index.index(entry({ industry: ["automotive", "leasing"] }));
    expect(index.search({ industry: "automotive" })).toHaveLength(1);
    expect(index.search({ industry: "retail" })).toHaveLength(0);
  });

  it("Find By Owner (005.3A Enhancement 9)", () => {
    const index = new SearchIndex();
    index.index(entry({ owner: "marketing-team" }));
    expect(index.search({ owner: "marketing-team" })).toHaveLength(1);
    expect(index.search({ owner: "sales-team" })).toHaveLength(0);
  });
});
