import type { KnowledgeUpdateReportType } from "../types/report-type.js";

export interface KnowledgeUpdateReportProps {
  readonly id: string;
  readonly type: KnowledgeUpdateReportType;
  readonly generatedAt: number;
  readonly data: Readonly<Record<string, unknown>>;
}

/** Immutable, generic report entity — `data`'s shape depends on `type` (see `builders/`). */
export class KnowledgeUpdateReport {
  readonly id: string;
  readonly type: KnowledgeUpdateReportType;
  readonly generatedAt: number;
  readonly data: Readonly<Record<string, unknown>>;

  constructor(props: KnowledgeUpdateReportProps) {
    this.id = props.id;
    this.type = props.type;
    this.generatedAt = props.generatedAt;
    this.data = props.data;
    Object.freeze(this);
  }
}
