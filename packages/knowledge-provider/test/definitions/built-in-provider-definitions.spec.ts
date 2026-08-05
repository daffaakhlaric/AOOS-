import { describe, expect, it } from "vitest";

import { BUILT_IN_PROVIDER_DEFINITIONS } from "../../src/definitions/built-in-provider-definitions.js";
import { KnowledgeProviderCategory } from "../../src/domain/knowledge-provider-category.js";

describe("BUILT_IN_PROVIDER_DEFINITIONS", () => {
  it("has exactly 28 definitions", () => {
    expect(BUILT_IN_PROVIDER_DEFINITIONS).toHaveLength(28);
  });

  it("every definition has a unique id", () => {
    const ids = BUILT_IN_PROVIDER_DEFINITIONS.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every definition declares at least one default capability", () => {
    for (const definition of BUILT_IN_PROVIDER_DEFINITIONS) {
      expect(definition.defaultCapabilities.length).toBeGreaterThan(0);
    }
  });

  it("every definition uses a valid KnowledgeProviderCategory", () => {
    const validCategories = new Set(Object.values(KnowledgeProviderCategory));
    for (const definition of BUILT_IN_PROVIDER_DEFINITIONS) {
      expect(validCategories.has(definition.category)).toBe(true);
    }
  });

  it("includes Google Drive as a STORAGE provider", () => {
    const googleDrive = BUILT_IN_PROVIDER_DEFINITIONS.find(
      (definition) => definition.id === "google-drive",
    );
    expect(googleDrive?.category).toBe(KnowledgeProviderCategory.STORAGE);
  });

  it("includes GitHub as a REPOSITORY provider", () => {
    const github = BUILT_IN_PROVIDER_DEFINITIONS.find((definition) => definition.id === "github");
    expect(github?.category).toBe(KnowledgeProviderCategory.REPOSITORY);
  });

  it("includes PostgreSQL as a DATABASE provider", () => {
    const postgres = BUILT_IN_PROVIDER_DEFINITIONS.find(
      (definition) => definition.id === "postgresql",
    );
    expect(postgres?.category).toBe(KnowledgeProviderCategory.DATABASE);
  });

  it("includes Custom Provider as a FUTURE_PROVIDER category", () => {
    const custom = BUILT_IN_PROVIDER_DEFINITIONS.find(
      (definition) => definition.id === "custom-provider",
    );
    expect(custom?.category).toBe(KnowledgeProviderCategory.FUTURE_PROVIDER);
  });

  it.each([
    ["notion", KnowledgeProviderCategory.CMS],
    ["confluence", KnowledgeProviderCategory.CMS],
    ["sharepoint", KnowledgeProviderCategory.CMS],
    ["gitlab", KnowledgeProviderCategory.REPOSITORY],
    ["dropbox", KnowledgeProviderCategory.STORAGE],
    ["onedrive", KnowledgeProviderCategory.STORAGE],
    ["amazon-s3", KnowledgeProviderCategory.CLOUD],
    ["azure-blob", KnowledgeProviderCategory.CLOUD],
    ["local-folder", KnowledgeProviderCategory.FILESYSTEM],
    ["ftp", KnowledgeProviderCategory.FILESYSTEM],
    ["sftp", KnowledgeProviderCategory.FILESYSTEM],
    ["rest-api", KnowledgeProviderCategory.API],
    ["graphql", KnowledgeProviderCategory.API],
    ["mysql", KnowledgeProviderCategory.DATABASE],
    ["sql-server", KnowledgeProviderCategory.DATABASE],
    ["oracle", KnowledgeProviderCategory.DATABASE],
    ["mongodb", KnowledgeProviderCategory.DATABASE],
    ["redis", KnowledgeProviderCategory.DATABASE],
    ["elasticsearch", KnowledgeProviderCategory.DATABASE],
    ["opensearch", KnowledgeProviderCategory.DATABASE],
    ["salesforce", KnowledgeProviderCategory.CRM],
    ["hubspot", KnowledgeProviderCategory.CRM],
    ["sap", KnowledgeProviderCategory.ERP],
    ["dynamics", KnowledgeProviderCategory.ERP],
  ])("categorizes %s as %s", (id, category) => {
    const definition = BUILT_IN_PROVIDER_DEFINITIONS.find((entry) => entry.id === id);
    expect(definition?.category).toBe(category);
  });

  it("carries no implementation-shaped fields (only id/name/category/capabilities/description)", () => {
    for (const definition of BUILT_IN_PROVIDER_DEFINITIONS) {
      expect(Object.keys(definition).sort()).toEqual(
        ["category", "defaultCapabilities", "description", "id", "name"].sort(),
      );
    }
  });
});
