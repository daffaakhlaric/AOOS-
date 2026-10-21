import type { SupabaseClientLike } from "@aos/lead-store";

import type { ProductionJob } from "../domain/kai-production.js";
import type { StructuredCreativeBrief } from "../domain/structured-creative-brief.js";

interface RpcClient {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: ProductionJob | null; error: unknown }>;
}
export class KaiProductionRepository {
  constructor(private readonly db: SupabaseClientLike) {}

  /** Callback task IDs only wake a known job; provider status and output are verified by the worker. */
  async wakeProviderTask(taskId: string): Promise<boolean> {
    const found = await this.db
      .from<ProductionJob>("kai_generation_jobs")
      .select("id,tenant_id")
      .eq("provider_task_id", taskId)
      .eq("status", "RUNNING")
      .maybeSingle();
    if (found.error) throw new Error("CALLBACK_JOB_LOOKUP_FAILED");
    if (!found.data) return false;
    const result = await this.db
      .from<ProductionJob>("kai_generation_jobs")
      .update({ next_attempt_at: new Date().toISOString() })
      .eq("tenant_id", found.data.tenant_id)
      .eq("id", found.data.id)
      .eq("provider_task_id", taskId)
      .eq("status", "RUNNING")
      .select("id");
    if (result.error) throw new Error("CALLBACK_JOB_WAKE_FAILED");
    return Boolean(result.data?.length);
  }

  async claim(worker: string): Promise<ProductionJob | null> {
    const result = await (this.db as unknown as RpcClient).rpc("claim_kai_generation_job", {
      p_worker: worker,
    });
    if (result.error) throw new Error("JOB_CLAIM_FAILED");
    return result.data;
  }

  async update(job: ProductionJob, values: Partial<ProductionJob>): Promise<ProductionJob> {
    const result = await this.db
      .from<ProductionJob>("kai_generation_jobs")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("tenant_id", job.tenant_id)
      .eq("id", job.id)
      .eq("lease_owner", job.lease_owner)
      .gte("lease_until", new Date().toISOString())
      .select("*")
      .maybeSingle();
    if (result.error) throw new Error("JOB_UPDATE_FAILED");
    if (!result.data) throw new Error("JOB_LEASE_LOST");
    return result.data;
  }

  async context(job: ProductionJob) {
    const concept = await this.db
      .from<{ data: { aspectRatios: string[] } }>("kai_concepts")
      .select("data")
      .eq("tenant_id", job.tenant_id)
      .eq("id", job.concept_id)
      .eq("project_id", job.project_id)
      .eq("brief_id", job.brief_id)
      .maybeSingle();
    const board = await this.db
      .from<{ id: string }>("kai_storyboards")
      .select("id")
      .eq("tenant_id", job.tenant_id)
      .eq("concept_id", job.concept_id)
      .order("revision", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (concept.error || board.error) throw new Error("PRODUCTION_CONTEXT_UNAVAILABLE");
    if (!concept.data || board.data?.id !== job.storyboard_id)
      throw new Error("STORYBOARD_SUPERSEDED");
    return concept.data.data;
  }

  /** Existing package inventory gets owned URLs, never temporary KIE URLs or automatic approval. */
  async syncPackage(job: ProductionJob, brief?: StructuredCreativeBrief) {
    const assets = job.output?.assets ?? [];
    const firstText = job.output?.units[0]?.text;
    const copyVariants =
      brief && firstText
        ? [
            {
              id: `${job.id}:copy-1`,
              variantLabel: "Kai · approved source",
              primaryText: firstText,
              headline: brief.offer.primaryOffer ?? "Rumah pilihan Anda",
              callToAction: brief.CTA.label,
              description: brief.offer.primaryOffer ?? undefined,
            },
          ]
        : undefined;
    const result = await this.db
      .from("creative_packages")
      .update({
        image_urls: assets.filter((a) => a.mimeType.startsWith("image/")).map((a) => a.url),
        video_url: assets.find((a) => a.mimeType === "video/mp4")?.url ?? null,
        ai_model: job.model,
        status: job.output?.qa?.passed ? "PENDING" : "FAILED",
        error_message: job.output?.qa?.passed
          ? null
          : "QA belum lulus. Buka hasil pemeriksaan pada job produksi.",
        ...(copyVariants ? { copy_variants: copyVariants } : {}),
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", job.tenant_id)
      .eq("id", job.concept_id)
      .eq("brief_id", job.brief_id)
      .select("id");
    if (result.error || !result.data?.length) throw new Error("PACKAGE_SYNC_FAILED");
  }
}
