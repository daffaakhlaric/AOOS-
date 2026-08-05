/** "PROVIDER RESOLVER: Resolve providers only. No provider implementation. Supported Provider Types Document, Storage, Repository, CMS, Database, API, File System, Knowledge Service, Future Provider." (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md) */
export enum KnowledgeSynchronizationProviderType {
  DOCUMENT = "document",
  STORAGE = "storage",
  REPOSITORY = "repository",
  CMS = "cms",
  DATABASE = "database",
  API = "api",
  FILE_SYSTEM = "file_system",
  KNOWLEDGE_SERVICE = "knowledge_service",
  FUTURE_PROVIDER = "future_provider",
}
