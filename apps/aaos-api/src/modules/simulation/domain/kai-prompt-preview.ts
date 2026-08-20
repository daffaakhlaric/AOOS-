import { randomUUID } from "node:crypto";

import {
  AutomotivePromptBuilder,
  CopyBuilder,
  FormatDecider,
  FormatDecisionService,
  PromptBuildingService,
} from "@aos/creative-agent";
import { CreativeBrief, CreativeBriefId, TargetPersona } from "@aos/meta-ads-agent";
import type { AdAngle } from "@aos/meta-ads-agent";
import type { Branch } from "@aos/meta-ads-connector";

import type { KaiPromptDetail } from "./simulation-record.js";

const formatDecisionService = new FormatDecisionService(new FormatDecider());
const promptBuildingService = new PromptBuildingService(new AutomotivePromptBuilder());
const copyBuilder = new CopyBuilder();

/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 3, section C — builds the REAL Kai/Kie AI prompt
 * detail for a Simulasi run's `kai.brief`, by re-running the brief through the exact same
 * deterministic, no-external-call classes `KaiAgentService.processCreativeBrief` composes
 * (`FormatDecisionService`, `PromptBuildingService`/`AutomotivePromptBuilder`, `CopyBuilder`).
 * `CreativeOrchestratorService` (the real Kie AI upload/generate calls) is deliberately never
 * constructed here — same hard scope boundary `SimulationService`'s class doc already documents for
 * Step 3 ("real Kie AI video generation is NOT invoked in this pass").
 *
 * AUTOMOTIVE ONLY: `AutomotivePromptBuilder`/`CopyBuilder` are the only real, wired implementations
 * for this pipeline today — `@aos/creative-agent`'s `PropertyPromptBuilder` (Phase 2) takes a
 * structurally different `PropertyCreativeBrief` (listing-shaped, not `CreativeBrief`-shaped) and
 * has no property-vertical `FormatDecider`/`CopyBuilder` counterpart, and the Simulasi pipeline has
 * no real per-request tenant/vertical resolution yet (`SimulationService` reads a single static
 * `AaosApiConfig.AAOS_TENANT_ID`, not a request-scoped tenant — see COORDINATOR NOTE #4). Building a
 * property branch here honestly would mean fabricating a format/copy decision this codebase cannot
 * really make yet, so this function is automotive-only; a `PROPERTY`-vertical caller degrades to
 * `available: false` rather than a half-real result. See this phase's final report for the follow-up
 * this leaves open.
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
    // The Simulasi wizard collects no target-persona choice for Kai's brief today (only Jessy's
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
