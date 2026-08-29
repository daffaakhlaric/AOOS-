import { randomUUID } from "node:crypto";

import {
  AutomotivePromptBuilder,
  CopyBuilder,
  CreativeFormat,
  FormatDecider,
  FormatDecisionService,
  PromptBuildingService,
  PropertyCopyBuilder,
  PropertyFormatDecider,
  PropertyPromptBuilder,
} from "@aos/creative-agent";
import type { PropertyCreativeBrief } from "@aos/creative-agent";
import { CreativeBrief, CreativeBriefId, TargetPersona } from "@aos/meta-ads-agent";
import type { AdAngle } from "@aos/meta-ads-agent";
import type { Branch } from "@aos/meta-ads-connector";

import type { KaiPromptDetail } from "./simulation-record.js";

const formatDecisionService = new FormatDecisionService(new FormatDecider());
const promptBuildingService = new PromptBuildingService(new AutomotivePromptBuilder());
const copyBuilder = new CopyBuilder();

const propertyFormatDecider = new PropertyFormatDecider();
const propertyPromptBuilder = new PropertyPromptBuilder();
const propertyCopyBuilder = new PropertyCopyBuilder();

/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 3, section C — builds the REAL Kai/Kie AI prompt
 * detail for a Simulasi run's `kai.brief`, by re-running the brief through the exact same
 * deterministic, no-external-call classes `KaiAgentService.processCreativeBrief` composes
 * (`FormatDecisionService`, `PromptBuildingService`/`AutomotivePromptBuilder`, `CopyBuilder`).
 * `CreativeOrchestratorService` (the real Kie AI upload/generate calls) is deliberately never
 * constructed here — same hard scope boundary `SimulationService`'s class doc already documents for
 * Step 3 ("real Kie AI video generation is NOT invoked in this pass").
 *
 * AUTOMOTIVE ONLY (this function): `AutomotivePromptBuilder`/`CopyBuilder`/`CreativeBrief` are all
 * hard-typed to the automotive ad-refresh shape (`unit`/`branch`/`formats`/`urgency`, sourced from
 * `LlmService.creativeBrief`'s real Meta-ad-driven brief) — there is no way to feed this function a
 * `PropertyCreativeBrief` (listing-shaped, no `formats`/`urgency`). PROPERTY-vertical Kai prompts
 * are built by the sibling `buildPropertyKaiPromptDetail` below instead, using Phase 6's real
 * `PropertyFormatDecider`/`PropertyPromptBuilder`/`PropertyCopyBuilder` over the tenant's selected
 * `listings` row (Step 1's "Pilih Listing") rather than a Meta-ad brief — `SimulationService`
 * dispatches to whichever of the two applies for the resolved vertical.
 *
 * NEVER FAILS THE RUN: a real `CreativeBrief.create` validation failure, or a thrown asset-library
 * lookup, degrades to `undefined` (see `KaiStageResult.promptDetail`'s doc) — this is a display
 * nicety layered on top of the already-real `kai.brief`, not a new gate.
 */
export interface BuildKaiPromptDetailInput {
  readonly unit: string;
  readonly unitModel?: string;
  readonly branch: Branch;
  readonly angle: AdAngle;
  readonly primaryMessage: string;
  readonly tone: string;
  readonly avoid: readonly string[];
  readonly formats: ReadonlyArray<"VIDEO_15S" | "VIDEO_30S" | "IMAGE_SQUARE" | "IMAGE_STORY">;
  readonly urgency: "HIGH" | "MEDIUM" | "LOW";
  readonly sourcePhotoUrls: readonly string[];
}

export function buildKaiPromptDetail(
  input: BuildKaiPromptDetailInput,
): KaiPromptDetail | undefined {
  const briefIdResult = CreativeBriefId.create(randomUUID());
  if (!briefIdResult.ok) {
    return undefined;
  }
  const briefResult = CreativeBrief.create({
    id: briefIdResult.value,
    // A Simulasi run has no real originating ad — `adId` is provenance-only (see
    // `creative-brief.factory.ts`'s identical fallback rationale for manual briefs).
    adId: `simulasi-${briefIdResult.value.toString()}`,
    unit: input.unit,
    ...(input.unitModel !== undefined ? { unitModel: input.unitModel } : {}),
    branch: input.branch,
    angle: input.angle,
    // The Simulasi wizard collects no target-persona choice for Kai's brief today (only Clara's
    // persona selection, a different concept) — reusing `PRIMARY_FAMILY`, DSS Motor's real default
    // persona, honestly labelled here rather than inventing a per-run value with no real input.
    targetPersona: TargetPersona.PRIMARY_FAMILY,
    primaryMessage: input.primaryMessage,
    tone: input.tone,
    avoid: input.avoid,
    formats: input.formats,
    reason: "Simulasi dry-run — preview prompt Kai, tidak ada generate Kie AI nyata.",
    urgency: input.urgency,
    estimatedImpactIfRefreshed: "Belum diestimasi",
    createdAt: new Date(),
  });
  if (!briefResult.ok) {
    return undefined;
  }
  const brief = briefResult.value;

  const decision = formatDecisionService.decide(brief, input.sourcePhotoUrls.length);
  const sourcePhotoAvailable = input.sourcePhotoUrls.length > 0;
  const prompts = promptBuildingService.build(
    brief,
    decision.videoSpec !== undefined,
    sourcePhotoAvailable,
  );

  const copyResult = copyBuilder.buildVariants(brief);
  const copyVariants = copyResult.ok
    ? copyResult.value.map((variant) => ({
        id: variant.id,
        variantLabel: variant.variantLabel,
        primaryText: variant.primaryText,
        headline: variant.headline,
        callToAction: variant.callToAction,
      }))
    : [];

  return {
    ...(prompts.videoPrompt !== undefined ? { videoPrompt: prompts.videoPrompt } : {}),
    imagePrompts: prompts.imagePrompts,
    copyVariants,
    ...(!copyResult.ok ? { copyVariantsUnavailableReason: copyResult.error.message } : {}),
    sourcePhotoUrls: input.sourcePhotoUrls,
    format: decision.format,
    imageModel: decision.imageSpec.model,
    imageAspectRatio: decision.imageSpec.aspectRatio,
    imageCount: decision.imageSpec.count,
    ...(decision.videoSpec !== undefined
      ? {
          videoModel: decision.videoSpec.model,
          videoDurationSeconds: decision.videoSpec.durationSeconds,
          videoAspectRatio: decision.videoSpec.aspectRatio,
        }
      : {}),
  };
}

/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 6 — builds the REAL Kai/Kie AI prompt detail for a
 * PROPERTY-vertical Simulasi run, using Phase 6's real `PropertyFormatDecider`/
 * `PropertyPromptBuilder`/`PropertyCopyBuilder` over the caller's already-real
 * `PropertyCreativeBrief` (built by `SimulationService` from the tenant's selected `listings` row
 * — Step 1's "Pilih Listing" — never fabricated). Mirrors `buildKaiPromptDetail`'s structure
 * exactly (decide format/specs, build prompts, build copy) but has no `CreativeBrief.create`
 * validation step to fail: `PropertyCreativeBrief` is a plain, already-validated struct (its
 * fields come straight off a real, already-persisted `listings` row plus the tenant's selected
 * angle), so this function cannot itself produce an "invalid brief" outcome the way the automotive
 * path can. NEVER FAILS THE RUN: any error a caller wraps this in still degrades to `undefined`
 * (see `KaiStageResult.promptDetail`'s doc), same discipline as `buildKaiPromptDetail`.
 */
export function buildPropertyKaiPromptDetail(
  brief: PropertyCreativeBrief,
  sourcePhotoUrls: readonly string[],
): KaiPromptDetail {
  const availablePhotos = sourcePhotoUrls.length;
  const format = propertyFormatDecider.decideFormat(brief, availablePhotos);
  const imageSpec = propertyFormatDecider.decideImageSpec(brief);
  const videoSpec =
    format === CreativeFormat.VIDEO_AND_IMAGES
      ? propertyFormatDecider.decideVideoSpec(brief)
      : undefined;

  const sourcePhotoAvailable = availablePhotos > 0;
  const videoPrompt =
    videoSpec !== undefined
      ? propertyPromptBuilder.buildVideoPrompt(brief, sourcePhotoAvailable)
      : undefined;
  const imagePrompts = Array.from({ length: imageSpec.count }, (_, index) =>
    propertyPromptBuilder.buildImagePrompt(brief, index),
  );

  const copyResult = propertyCopyBuilder.buildVariants(brief);
  const copyVariants = copyResult.ok
    ? copyResult.value.map((variant) => ({
        id: variant.id,
        variantLabel: variant.variantLabel,
        primaryText: variant.primaryText,
        headline: variant.headline,
        callToAction: variant.callToAction,
      }))
    : [];

  return {
    ...(videoPrompt !== undefined ? { videoPrompt } : {}),
    imagePrompts,
    copyVariants,
    ...(!copyResult.ok ? { copyVariantsUnavailableReason: copyResult.error.message } : {}),
    sourcePhotoUrls,
    format,
    imageModel: imageSpec.model,
    imageAspectRatio: imageSpec.aspectRatio,
    imageCount: imageSpec.count,
    ...(videoSpec !== undefined
      ? {
          videoModel: videoSpec.model,
          videoDurationSeconds: videoSpec.durationSeconds,
          videoAspectRatio: videoSpec.aspectRatio,
        }
      : {}),
  };
}
