import type { SupabaseClientLike } from "@aos/lead-store";
import { ConflictException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";

import type { ProductionOutput } from "../domain/kai-production.js";
import type { StructuredCreativeBrief } from "../domain/structured-creative-brief.js";
import type { SaveCampaignDraft } from "../dto/campaign-draft.dto.js";
import type { KaiJobStatus } from "../dto/kai-generation.dto.js";

export interface HandoffDraftRow {
  tenant_id: string;
  id: string;
  listing_id: string;
  data: Omit<SaveCampaignDraft, "expectedRevision">;
  revision: number;
  status: "READY" | "NEEDS_INPUT";
  missing_fields: string[];
  updated_at: string;
}
export interface KaiProjectRow {
  tenant_id: string;
  id: string;
  campaign_draft_id: string;
  creative_brief_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}
interface BriefRow {
  tenant_id: string;
  id: string;
  data: StructuredCreativeBrief;
}
export interface HandoffRecord {
  draft: HandoffDraftRow;
  project: KaiProjectRow | null;
}
interface RpcClient {
  rpc<T = HandoffRecord>(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: T | null; error: { code?: string; message: string } | null }>;
}

/** Existing shared Supabase connection, with all writes committed by one database transaction. */
export class CreativeHandoffRepository {
  constructor(private readonly db: SupabaseClientLike) {}

  async getConcepts(tenant: string, project: string, brief: string) {
    const result = await this.db
      .from<{
        id: string;
        data: Record<string, unknown>;
        storyboards: { revision: number; data: Record<string, unknown> }[];
      }>("kai_concepts")
      .select("id,data,storyboards:kai_storyboards(revision,data)")
      .eq("tenant_id", tenant)
      .eq("project_id", project)
      .eq("brief_id", brief)
      .order("ordinal", { ascending: true });
    if (result.error)
      throw new ServiceUnavailableException("Konsep Kai belum dapat dimuat. Periksa migrasi 065.");
    return (result.data ?? []).map((row) => ({
      ...row.data,
      id: row.id,
      storyboard: [...row.storyboards].sort((a, b) => b.revision - a.revision)[0] ?? null,
    }));
  }

  async ensureConcepts(tenant: string, project: string, brief: string, concepts: unknown[]) {
    const result = await (this.db as unknown as RpcClient).rpc("ensure_kai_concepts", {
      p_tenant: tenant,
      p_project: project,
      p_brief: brief,
      p_concepts: concepts,
    });
    if (result.error?.code === "22023")
      throw new ConflictException("Brief berubah. Muat ulang proyek.");
    if (result.error)
      throw new ServiceUnavailableException(
        "Konsep dan storyboard belum tersimpan. Periksa migrasi 065.",
      );
  }

  async enqueueReviewed(
    tenant: string,
    project: string,
    conceptIds: string[],
    revisions: Record<string, number>,
    mode: "FULL" | "SAMPLE",
  ) {
    const result = await (this.db as unknown as RpcClient).rpc("enqueue_kai_reviewed_jobs", {
      p_tenant: tenant,
      p_project: project,
      p_concept_ids: conceptIds,
      p_revisions: revisions,
      p_mode: mode,
    });
    if (result.error?.code === "40001")
      throw new ConflictException(
        "Storyboard berubah. Muat ulang dan tinjau versi terbaru sebelum produksi.",
      );
    if (result.error?.code === "22023")
      throw new ConflictException("Brief atau konsep tidak lagi siap diproduksi.");
    if (result.error)
      throw new ServiceUnavailableException(
        "Approval produksi belum tersedia. Periksa migrasi 072.",
      );
    return this.listJobs(tenant, project);
  }

  async listJobs(tenant: string, project: string): Promise<KaiJobStatus[]> {
    const { brief } = await this.getProject(tenant, project);
    const result = await this.db
      .from<KaiJobStatus & { plan: { renderMode?: string }; output: ProductionOutput | null }>(
        "kai_generation_jobs",
      )
      .select(
        "id,concept_id,brief_id,storyboard_id,status,format,model,error_code,created_at,updated_at,output,plan",
      )
      .eq("tenant_id", tenant)
      .eq("project_id", project)
      .eq("brief_id", brief.briefId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (result.error) throw new ServiceUnavailableException("Status produksi belum dapat dimuat.");
    return (result.data ?? []).map(({ output, plan, ...job }) => ({
      ...job,
      renderMode: plan?.renderMode === "SAMPLE" ? ("SAMPLE" as const) : ("FULL" as const),
      assets: (output?.assets ?? []).map(
        ({ id, url, mimeType, previewUrl, ratio, durationSeconds }) => ({
          id,
          url,
          mimeType,
          previewUrl,
          ratio,
          durationSeconds,
        }),
      ),
      ...(output?.qa ? { qa: output.qa } : {}),
    }));
  }

  async listProjects(tenantId: string) {
    const result = await this.db
      .from<KaiProjectRow & { brief: { data: StructuredCreativeBrief } }>("kai_projects")
      .select("*, brief:structured_creative_briefs(data)")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (result.error)
      throw new ServiceUnavailableException("Daftar proyek Kai tidak dapat dimuat.");
    return (result.data ?? []).map((row) => ({
      id: row.id,
      briefId: row.creative_brief_id,
      campaignDraftId: row.campaign_draft_id,
      status: row.status,
      updatedAt: row.updated_at,
      title: row.brief.data.offer.primaryOffer ?? row.brief.data.objective,
      objective: row.brief.data.objective,
    }));
  }

  async save(
    tenantId: string,
    input: SaveCampaignDraft,
    brief: StructuredCreativeBrief | null,
    hash: string | null,
    missing: string[],
  ): Promise<HandoffRecord> {
    const { expectedRevision, ...data } = input;
    const result = await (this.db as unknown as RpcClient).rpc("save_campaign_creative_handoff", {
      p_tenant: tenantId,
      p_id: input.id,
      p_listing: input.listingId,
      p_data: data,
      p_revision: expectedRevision,
      p_brief: brief,
      p_hash: hash,
      p_missing: missing,
    });
    if (result.error?.code === "40001" || result.error?.code === "22023")
      throw new ConflictException(
        "Draft berubah atau listing berbeda. Muat ulang sebelum menyimpan.",
      );
    if (result.error || !result.data)
      throw new ServiceUnavailableException(
        "Penyimpanan campaign–Kai belum tersedia. Periksa migrasi 064 dan koneksi database.",
      );
    return result.data;
  }

  async getDraft(tenantId: string, id: string): Promise<HandoffRecord> {
    const { data: draft, error } = await this.db
      .from<HandoffDraftRow>("campaign_creative_drafts")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    if (error)
      throw new ServiceUnavailableException(
        "Penyimpanan campaign–Kai belum tersedia. Periksa migrasi 064.",
      );
    if (!draft) throw new NotFoundException("Draft tidak tersedia.");
    const projectResult = await this.db
      .from<KaiProjectRow>("kai_projects")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("campaign_draft_id", id)
      .maybeSingle();
    if (projectResult.error)
      throw new ServiceUnavailableException("Proyek Kai tidak dapat dimuat.");
    return { draft, project: projectResult.data };
  }

  async getProject(tenantId: string, id: string) {
    const { data: project, error } = await this.db
      .from<KaiProjectRow>("kai_projects")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    if (error)
      throw new ServiceUnavailableException("Proyek Kai tidak dapat dimuat. Periksa migrasi 064.");
    if (!project) throw new NotFoundException("Proyek Kai tidak tersedia.");
    const brief = await this.db
      .from<BriefRow>("structured_creative_briefs")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", project.creative_brief_id)
      .single();
    if (brief.error || !brief.data)
      throw new ServiceUnavailableException("Brief proyek tidak dapat dimuat.");
    return { project, brief: brief.data.data };
  }
}
