import type { KnowledgeMetricUnit } from "../types/common.js";
import type { KnowledgeMetricCategory } from "../types/metric-category.js";

/** Constructor properties for {@link KnowledgeMetricDefinition}. */
export interface KnowledgeMetricDefinitionProps {
  readonly id: string;
  readonly name: string;
  readonly category: KnowledgeMetricCategory;
  readonly unit: KnowledgeMetricUnit;
  readonly description: string;
}

/** Immutable value object describing a metric registered in {@link KnowledgeMetricRegistry}. */
export class KnowledgeMetricDefinition {
  public readonly id: string;
  public readonly name: string;
  public readonly category: KnowledgeMetricCategory;
  public readonly unit: KnowledgeMetricUnit;
  public readonly description: string;

  constructor(props: KnowledgeMetricDefinitionProps) {
    this.id = props.id;
    this.name = props.name;
    this.category = props.category;
    this.unit = props.unit;
    this.description = props.description;
    Object.freeze(this);
  }
}
