export interface SourceLocation {
  page?: number;
  sheet?: string;
  rowStart?: number;
  rowEnd?: number;
  section?: string;
  paragraph?: number;
}
export interface ParsedSection {
  text: string;
  source: SourceLocation;
}
export interface KnowledgeFact {
  key: string;
  value: string | number;
  raw: string;
  source: SourceLocation;
}
export interface KnowledgeChunk extends ParsedSection {
  sequence: number;
  hash: string;
  facts: KnowledgeFact[];
}
export interface KnowledgeDocument {
  id: string;
  tenant_id: string;
  listing_id: string;
  file_name: string;
  mime_type: string;
  storage_key: string;
  content_hash: string;
  status: string;
  error_code: string | null;
  is_active: boolean;
}
export interface KnowledgeHit {
  id: string;
  document_id: string;
  file_name: string;
  text_content: string;
  source: SourceLocation;
  facts: KnowledgeFact[];
  score: number;
}
export const DOCUMENT_FORMATS = [".pdf", ".xlsx", ".csv", ".docx", ".txt"] as const;
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
export class KnowledgeError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
