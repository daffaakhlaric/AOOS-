export type KaiCreativeFormat = "IMAGE" | "VIDEO" | "CAROUSEL";
export type KaiStage =
  | "BRIEF"
  | "STRATEGY"
  | "CONCEPTS"
  | "ART_DIRECTION"
  | "SCRIPT"
  | "STORYBOARD"
  | "SLIDE_PLAN"
  | "ASSET_PLAN"
  | "APPROVAL"
  | "PRODUCE"
  | "QA"
  | "SIMULATION"
  | "FINALIZE"
  | "HANDOFF";
type Pipeline = {
  id: string;
  format: KaiCreativeFormat;
  label: string;
  stages: readonly KaiStage[];
  requiredInputs: readonly string[];
  capabilities: readonly string[];
  approvalBefore: "PRODUCE";
  costEstimate: null;
  costStatus: "UNAVAILABLE";
};
/** Registry describes existing execution paths, not capabilities that the worker cannot perform. */
export const KaiPipelineRegistry: Readonly<Record<KaiCreativeFormat, Pipeline>> = {
  IMAGE: {
    id: "IMAGE_SOURCE_COMPOSITION",
    format: "IMAGE",
    label: "Image · Source composition",
    stages: [
      "BRIEF",
      "STRATEGY",
      "CONCEPTS",
      "ART_DIRECTION",
      "ASSET_PLAN",
      "APPROVAL",
      "PRODUCE",
      "QA",
      "SIMULATION",
      "FINALIZE",
      "HANDOFF",
    ],
    requiredInputs: ["VERIFIED_CLAIMS", "SOURCE_PHOTOS"],
    capabilities: ["IMAGE_GENERATION", "DETERMINISTIC_LAYOUT"],
    approvalBefore: "PRODUCE",
    costEstimate: null,
    costStatus: "UNAVAILABLE",
  },
  VIDEO: {
    id: "VIDEO_ASSET_MONTAGE",
    format: "VIDEO",
    label: "Video · Real asset montage",
    stages: [
      "BRIEF",
      "STRATEGY",
      "CONCEPTS",
      "SCRIPT",
      "STORYBOARD",
      "ASSET_PLAN",
      "APPROVAL",
      "PRODUCE",
      "QA",
      "SIMULATION",
      "FINALIZE",
      "HANDOFF",
    ],
    requiredInputs: ["VERIFIED_CLAIMS", "SOURCE_PHOTOS", "SCENE_TIMING"],
    capabilities: ["SOURCE_MOTION", "COMPOSITION"],
    approvalBefore: "PRODUCE",
    costEstimate: null,
    costStatus: "UNAVAILABLE",
  },
  CAROUSEL: {
    id: "CAROUSEL_SOURCE_STORY",
    format: "CAROUSEL",
    label: "Carousel · Source story",
    stages: [
      "BRIEF",
      "STRATEGY",
      "CONCEPTS",
      "SLIDE_PLAN",
      "ASSET_PLAN",
      "APPROVAL",
      "PRODUCE",
      "QA",
      "SIMULATION",
      "FINALIZE",
      "HANDOFF",
    ],
    requiredInputs: ["VERIFIED_CLAIMS", "SOURCE_PHOTOS", "ORDERED_SLIDES"],
    capabilities: ["IMAGE_GENERATION", "DETERMINISTIC_LAYOUT"],
    approvalBefore: "PRODUCE",
    costEstimate: null,
    costStatus: "UNAVAILABLE",
  },
};
export function selectKaiPipeline(format: KaiCreativeFormat, sourcePhotoCount: number) {
  if (!Number.isInteger(sourcePhotoCount) || sourcePhotoCount < 1)
    throw new Error("SOURCE_MEDIA_REQUIRED");
  const pipeline = KaiPipelineRegistry[format];
  if (!pipeline) throw new Error("UNSUPPORTED_CREATIVE_FORMAT");
  return {
    ...pipeline,
    reason:
      "Format mengikuti brief Samantha; sumber listing dipakai kembali. Estimasi harga provider belum tersedia.",
    version: 1,
  };
}
