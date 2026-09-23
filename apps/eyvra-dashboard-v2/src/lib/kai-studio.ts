import type { CreativePackageDto } from "@/types/dashboard.types";
export interface KaiPackage extends CreativePackageDto {
  briefId: string;
  stableId?: string;
  vertical: string;
  listingId?: string;
  adId?: string;
  angle: string;
  targetPersona?: string;
  reason: string;
  primaryMessage: string;
  origin: string;
  sourcePhotoUrls: string[];
  aiModel?: string;
  generationMs?: number;
  generatedAt?: string;
  reviewedAt?: string;
  publishedMetaAdIds?: string[];
  copyVariants: { id: string; variantLabel: string; headline: string; primaryText: string }[];
}
export interface KaiLog {
  id: string;
  eventType: string;
  message: string;
  createdAt: string;
  metadata?: unknown;
  brief?: unknown;
  result?: unknown;
}
export interface KaiDetail {
  package: KaiPackage;
  logs: KaiLog[];
}
export type ConceptState =
  | "Planning"
  | "Generating"
  | "QA Review"
  | "QA Failed"
  | "Ready"
  | "Rejected"
  | "Generation failed"
  | "Published"
  | "Asset missing";
export interface QAView {
  status: "Passed" | "Failed" | "Unavailable";
  checks: { name: string; passed: boolean; detail: string }[];
  attempt?: number;
  at?: string;
}
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export function mapQAResult(logs: KaiLog[]): QAView {
  const entry = [...logs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .find((log) => typeof object(log.metadata).qaPassed === "boolean");
  if (!entry) return { status: "Unavailable", checks: [] };
  const metadata = object(entry.metadata);
  return {
    status: metadata.qaPassed ? "Passed" : "Failed",
    at: entry.createdAt,
    attempt: typeof metadata.attempt === "number" ? metadata.attempt : undefined,
    checks: Array.isArray(metadata.qaChecks)
      ? metadata.qaChecks.flatMap((value) => {
          const check = object(value);
          return typeof check.check === "string" && typeof check.passed === "boolean"
            ? [
                {
                  name: check.check,
                  passed: check.passed,
                  detail: typeof check.detail === "string" ? check.detail : "",
                },
              ]
            : [];
        })
      : [],
  };
}
export function mapKaiConceptToCard(pkg: KaiPackage, detail?: KaiDetail) {
  const media = [
    ...(pkg.imageUrls ?? []).map((url, i) => ({
      id: `image-${i}`,
      kind: "image" as const,
      url,
      label: `Image ${i + 1}`,
    })),
    ...(pkg.videoUrl
      ? [{ id: "video", kind: "video" as const, url: pkg.videoUrl, label: "Video" }]
      : []),
  ];
  const qa = mapQAResult(detail?.logs ?? []);
  let status: ConceptState =
    pkg.status === "GENERATING"
      ? "Generating"
      : pkg.status === "FAILED"
        ? "Generation failed"
        : pkg.status === "REJECTED"
          ? "Rejected"
          : pkg.status === "APPROVED"
            ? media.length
              ? "Ready"
              : "Asset missing"
            : pkg.status === "PENDING"
              ? "QA Review"
              : "Planning";
  if (qa.status === "Failed" && pkg.status !== "GENERATING" && pkg.status !== "APPROVED")
    status = "QA Failed";
  if (pkg.publishedMetaAdIds?.length) status = "Published";
  return {
    id: pkg.id,
    label: pkg.stableId ?? pkg.id.slice(0, 8),
    name: pkg.title,
    angle: pkg.angle,
    format: pkg.decidedFormat ?? pkg.requestedFormat ?? "Format unavailable",
    model: pkg.aiModel,
    status,
    qa,
    media,
    generated: media.length > 0,
    preview: pkg.imageUrls?.[0],
    source: pkg.sourcePhotoUrls?.[0],
    pkg,
  };
}
export type KaiConcept = ReturnType<typeof mapKaiConceptToCard>;
export function mapKaiBriefToViewModel(packages: KaiPackage[], briefId: string) {
  const concepts = packages.filter((p) => p.briefId === briefId);
  const first = concepts[0];
  return {
    id: briefId,
    title: first?.title ?? "Creative brief",
    origin: first?.origin ?? "Unknown",
    createdAt: first?.createdAt,
    reason: first?.reason,
    message: first?.primaryMessage,
    listingId: first?.listingId,
    formats: [...new Set(concepts.map((p) => p.requestedFormat))],
    angles: [...new Set(concepts.map((p) => p.angle))],
    concepts,
  };
}
export function batchProgress(concepts: KaiConcept[]) {
  const ready = concepts.filter((c) => c.status === "Ready" || c.status === "Published").length;
  return {
    ready,
    total: concepts.length,
    percent: concepts.length ? Math.round((ready / concepts.length) * 100) : 0,
    generating: concepts.filter((c) => c.status === "Generating").length,
    review: concepts.filter((c) => c.status === "QA Review").length,
  };
}
export function productionSteps(concepts: KaiConcept[]) {
  const any = concepts.length > 0;
  const generated = any && concepts.every((c) => c.generated);
  const qaPassed = any && concepts.every((c) => c.qa.status === "Passed");
  const generating = concepts.some((c) => c.status === "Generating");
  const failed = concepts.some((c) => c.status === "Generation failed");
  const states = [
    any ? "Completed" : "Active",
    any ? "Completed" : "Pending",
    generated ? "Completed" : "Pending",
    failed
      ? "Failed"
      : generating
        ? "Active"
        : generated
          ? "Completed"
          : any
            ? "Active"
            : "Pending",
    concepts.some((c) => c.qa.status === "Failed")
      ? "Failed"
      : qaPassed
        ? "Completed"
        : generated
          ? "Active"
          : "Pending",
    qaPassed ? "Active" : "Pending",
    "Pending",
    "Pending",
  ];
  return ["Brief", "Concept", "Preview", "Generate", "QA", "Shortlist", "Test", "Winner"].map(
    (label, i) => ({ label, state: states[i] }),
  );
}
