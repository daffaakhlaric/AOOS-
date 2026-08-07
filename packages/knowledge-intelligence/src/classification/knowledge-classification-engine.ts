import type { ISpecification } from "../contracts/i-specification.js";
import { KnowledgeCategory } from "../types/knowledge-category.js";
import type { KnowledgeItemSnapshot } from "../types/knowledge-item.js";
import { KnowledgeClassification } from "../value-objects/knowledge-classification.js";

import { AndSpecification } from "./specifications/and-specification.js";
import { HasCategoryHintSpecification } from "./specifications/has-category-hint-specification.js";
import { HasExamplesSpecification } from "./specifications/has-examples-specification.js";
import { HasMinimumTagsSpecification } from "./specifications/has-minimum-tags-specification.js";
import { HasSummarySpecification } from "./specifications/has-summary-specification.js";
import { LongFormContentSpecification } from "./specifications/long-form-content-specification.js";
import { OrSpecification } from "./specifications/or-specification.js";
import { ShortFormContentSpecification } from "./specifications/short-form-content-specification.js";

export interface CategoryRule {
  readonly category: KnowledgeCategory;
  readonly specification: ISpecification<KnowledgeItemSnapshot>;
}

/**
 * Real Specification-pattern rules engine (not a machine-learning model): each built-in category
 * has an associated `ISpecification<KnowledgeItemSnapshot>` predicate, evaluated in priority
 * order. The first rule whose specification is satisfied wins; `confidence` is `1 / matchCount`
 * among all satisfied rules (fewer, more distinctive matches => higher confidence). Callers may
 * register additional rules ahead of the built-ins via the constructor.
 */
export class KnowledgeClassificationEngine {
  private readonly rules: readonly CategoryRule[];

  constructor(extraRules: readonly CategoryRule[] = []) {
    this.rules = [...extraRules, ...KnowledgeClassificationEngine.builtInRules()];
  }

  private static builtInRules(): readonly CategoryRule[] {
    return [
      {
        category: KnowledgeCategory.Reference,
        specification: new OrSpecification(
          new HasCategoryHintSpecification("reference"),
          new AndSpecification(new HasMinimumTagsSpecification(3), new HasSummarySpecification()),
        ),
      },
      {
        category: KnowledgeCategory.HowTo,
        specification: new OrSpecification(
          new HasCategoryHintSpecification("how_to"),
          new HasExamplesSpecification(),
        ),
      },
      {
        category: KnowledgeCategory.DeepDive,
        specification: new OrSpecification(
          new HasCategoryHintSpecification("deep_dive"),
          new LongFormContentSpecification(2000),
        ),
      },
      {
        category: KnowledgeCategory.Overview,
        specification: new OrSpecification(
          new HasCategoryHintSpecification("overview"),
          new ShortFormContentSpecification(200),
        ),
      },
    ];
  }

  classify(item: KnowledgeItemSnapshot): KnowledgeClassification {
    const matched = this.rules.filter((rule) => rule.specification.isSatisfiedBy(item));

    if (matched.length === 0) {
      return new KnowledgeClassification({
        itemId: item.id,
        category: KnowledgeCategory.Uncategorized,
        confidence: 0,
        matchedSpecifications: [],
      });
    }

    return new KnowledgeClassification({
      itemId: item.id,
      category: matched[0]!.category,
      confidence: Math.round((1 / matched.length) * 100) / 100,
      matchedSpecifications: matched.map((rule) => rule.specification.name),
    });
  }

  classifyAll(items: readonly KnowledgeItemSnapshot[]): readonly KnowledgeClassification[] {
    return items.map((item) => this.classify(item));
  }
}
