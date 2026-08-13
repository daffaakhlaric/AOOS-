import type { CreativeBrief } from "@aos/meta-ads-agent";

/** Port (Hexagonal Architecture) for Kai's Kie AI prompt generation (spec "Automotive Prompt Builder"). All output MUST be in English — Kai translates the Indonesian brief into English Kie AI prompts. The only implementation is `intelligence/AutomotivePromptBuilder.ts` — deterministic template rendering, no LLM calls. */
export interface IPromptBuilder {
  buildVideoPrompt(brief: CreativeBrief, sourcePhotoAvailable: boolean): string;
  buildImagePrompt(brief: CreativeBrief, variantIndex: number): string;
}
