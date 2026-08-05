import { describe, expect, it } from "vitest";

import { KnowledgeSourceCategory } from "../../src/domain/knowledge-source-category.js";

describe("KnowledgeSourceCategory individual values", () => {
  it("DOCUMENT", () => expect(KnowledgeSourceCategory.DOCUMENT).toBe("document"));
  it("REPOSITORY", () => expect(KnowledgeSourceCategory.REPOSITORY).toBe("repository"));
  it("CMS", () => expect(KnowledgeSourceCategory.CMS).toBe("cms"));
  it("STORAGE", () => expect(KnowledgeSourceCategory.STORAGE).toBe("storage"));
  it("DATABASE", () => expect(KnowledgeSourceCategory.DATABASE).toBe("database"));
  it("API", () => expect(KnowledgeSourceCategory.API).toBe("api"));
  it("CRM", () => expect(KnowledgeSourceCategory.CRM).toBe("crm"));
  it("ERP", () => expect(KnowledgeSourceCategory.ERP).toBe("erp"));
  it("FILESYSTEM", () => expect(KnowledgeSourceCategory.FILESYSTEM).toBe("filesystem"));
  it("CLOUD", () => expect(KnowledgeSourceCategory.CLOUD).toBe("cloud"));
  it("KNOWLEDGE", () => expect(KnowledgeSourceCategory.KNOWLEDGE).toBe("knowledge"));
  it("CUSTOM", () => expect(KnowledgeSourceCategory.CUSTOM).toBe("custom"));
});
