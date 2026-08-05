import type {
  IKnowledgeValidatorStage,
  KnowledgeValidationInput,
  KnowledgeValidationResult,
} from "./i-knowledge-validator.js";

/** "Template" — when an Asset declares a `templateId` and the matching `KnowledgeTemplate` is supplied, the Asset's `assetType` must match the Template's `assetType`. */
export class TemplateValidator implements IKnowledgeValidatorStage {
  readonly name = "template";

  validate(input: KnowledgeValidationInput): KnowledgeValidationResult {
    const issues: KnowledgeValidationResult["issues"][number][] = [];
    const asset = input.asset;
    const template = input.template;
    if (
      asset &&
      template &&
      asset.templateId === template.id &&
      asset.assetType !== template.assetType
    ) {
      issues.push({
        path: "templateId",
        message: `Asset assetType "${asset.assetType}" does not match Template "${template.id}"'s assetType "${template.assetType}"`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
