import { randomUUID } from "node:crypto";
import { extname } from "node:path";

import type { AssetLibrary } from "@aos/asset-library";
import type { Result } from "@aos/common";
import { NotFoundError, UnavailableError, ValidationError } from "@aos/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ASSET_LIBRARY, SUPABASE_CLIENT } from "../../di-tokens.js";

import { parseDocument } from "./document-parser.js";
import { KnowledgeModelGateway } from "./knowledge-model.gateway.js";
import {
  attachDocumentContext,
  buildChunks,
  detectPriceConflicts,
  hashContent,
} from "./knowledge-normalizer.js";
import {
  DOCUMENT_FORMATS,
  MAX_DOCUMENT_BYTES,
  KnowledgeError,
  type KnowledgeChunk,
  type KnowledgeDocument,
  type KnowledgeHit,
} from "./knowledge.types.js";
interface StorageDownload {
  download(path: string): Promise<Result<Buffer, Error>>;
  delete(path: string): Promise<unknown>;
}
@Injectable()
export class ListingKnowledgeService {
  private busy = false;
  private readonly logger = new Logger(ListingKnowledgeService.name);
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly db: SupabaseClient,
    @Inject(ASSET_LIBRARY) private readonly assets: AssetLibrary | undefined,
    private readonly models: KnowledgeModelGateway,
  ) {}
  private scope(tenant: string, listing: string) {
    if (!tenant || !listing) throw new ValidationError("Tenant and listing are required");
  }
  private async listing(tenant: string, id: string) {
    this.scope(tenant, id);
    const { data, error } = await this.db
      .from("listings")
      .select("id,title,price,city,property_type,wa_number,description")
      .eq("tenant_id", tenant)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new UnavailableError("Listing unavailable");
    if (!data) throw new NotFoundError("Listing not found");
    return data as {
      id: string;
      title: string;
      price: number;
      city: string | null;
      property_type: string;
      wa_number: string | null;
      description: string | null;
    };
  }
  async list(tenant: string, listing: string) {
    await this.listing(tenant, listing);
    const { data, error } = await this.db
      .from("listing_knowledge_documents")
      .select("id,file_name,mime_type,size_bytes,status,error_code,created_at,updated_at")
      .eq("tenant_id", tenant)
      .eq("listing_id", listing)
      .eq("is_active", true)
      .order("created_at");
    if (error) throw new UnavailableError("Knowledge database migration 060 is required");
    return { documents: data, formats: DOCUMENT_FORMATS, maxBytes: MAX_DOCUMENT_BYTES };
  }
  async upload(
    tenant: string,
    listing: string,
    file: { buffer: Buffer; fileName: string; mimeType: string },
  ) {
    await this.listing(tenant, listing);
    if (!this.assets) throw new UnavailableError("GCS unavailable");
    const extension = extname(file.fileName).toLowerCase();
    if (!(DOCUMENT_FORMATS as readonly string[]).includes(extension))
      throw new ValidationError("Unsupported document format");
    if (file.buffer.length === 0 || file.buffer.length > MAX_DOCUMENT_BYTES)
      throw new ValidationError("Document must be 1 byte to 20 MB");
    const hash = hashContent(file.buffer);
    const old = await this.db
      .from("listing_knowledge_documents")
      .select("id,is_active")
      .eq("tenant_id", tenant)
      .eq("listing_id", listing)
      .eq("content_hash", hash)
      .maybeSingle();
    if (old.error) throw new UnavailableError("Knowledge database migration 060 is required");
    if (old.data?.is_active) return { id: old.data.id as string, duplicate: true };
    if (old.data)
      throw new ValidationError("This document was archived. Upload a revised version.");
    const count = await this.db
      .from("listing_knowledge_documents")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant)
      .eq("listing_id", listing)
      .eq("is_active", true);
    if (count.error) throw new UnavailableError("Knowledge unavailable");
    if ((count.count ?? 0) >= 20) throw new ValidationError("Maximum 20 documents");
    const id = randomUUID(),
      key = "listings/" + tenant + "/" + listing + "/knowledge/" + id + extension;
    const result = await this.assets.assetStorage.upload({
      path: key,
      fileBody: file.buffer,
      contentType: file.mimeType,
    });
    if (!result.ok) throw new UnavailableError("GCS upload failed");
    const inserted = await this.db.from("listing_knowledge_documents").insert({
      id,
      tenant_id: tenant,
      listing_id: listing,
      file_name: file.fileName.slice(0, 255),
      mime_type: file.mimeType,
      size_bytes: file.buffer.length,
      storage_key: key,
      content_hash: hash,
    });
    if (inserted.error) {
      await (this.assets.assetStorage as unknown as StorageDownload)
        .delete(key)
        .catch(() => undefined);
      throw new UnavailableError("Document record could not be saved");
    }
    return { id, duplicate: false };
  }
  async remove(tenant: string, listing: string, id: string) {
    await this.listing(tenant, listing);
    const { data, error } = await this.db
      .from("listing_knowledge_documents")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenant)
      .eq("listing_id", listing)
      .eq("id", id)
      .select("id");
    if (error) throw new UnavailableError("Document could not be removed");
    if (!data?.length) throw new NotFoundError("Document not found");
    return { removed: true };
  }
  async retry(tenant: string, listing: string, id: string) {
    await this.listing(tenant, listing);
    const result = await this.db.rpc("retry_listing_knowledge", {
      p_tenant: tenant,
      p_listing: listing,
      p_document: id,
    });
    if (result.error) throw new UnavailableError("Retry unavailable");
    if (!result.data) throw new ValidationError("Document is missing or processing");
    return { queued: true };
  }
  async retrieve(
    tenant: string,
    listing: string,
    query: string,
    topK = 8,
  ): Promise<{ hits: KnowledgeHit[]; mode: string }> {
    await this.listing(tenant, listing);
    if (!query.trim() || query.length > 1000)
      throw new ValidationError("Query must be 1–1000 characters");
    let embedding: number[] | undefined;
    try {
      embedding = (await this.models.embed([query]))[0];
    } catch {
      /* Explicit keyword-only degraded mode. */
    }
    const { data, error } = await this.db.rpc("search_listing_knowledge", {
      p_tenant: tenant,
      p_listing: listing,
      p_query: query,
      p_embedding: embedding ? JSON.stringify(embedding) : null,
      p_limit: topK,
    });
    if (error) throw new UnavailableError("Knowledge retrieval unavailable");
    return { hits: data as KnowledgeHit[], mode: embedding ? "HYBRID" : "KEYWORD_ONLY" };
  }
  async analyze(tenant: string, listing: string) {
    const property = await this.listing(tenant, listing);
    if (property.price <= 0 || property.property_type === "UNSPECIFIED")
      throw new ValidationError("Lengkapi tipe dan harga sebelum analisis");
    const result = await this.retrieve(
      tenant,
      listing,
      "harga OR price OR promo OR DP OR KPR OR lokasi OR fasilitas",
      12,
    );
    const conflicts = detectPriceConflicts(property.price, result.hits);
    // Evidence is returned for review; time-sensitive promotions are never auto-approved by parsing.
    const sources = result.hits.map((h) => ({
      documentId: h.document_id,
      fileName: h.file_name,
      location: h.source,
      excerpt: h.text_content,
      claims: h.facts.map((f) => ({
        claim: f.raw,
        source: { documentId: h.document_id, fileName: h.file_name, ...f.source },
        requiresVerification: true,
      })),
    }));
    const candidates = result.hits.flatMap((h) =>
      h.facts
        .filter((f) => f.key !== "price")
        .map((f) => ({
          claim: f.raw,
          source: { documentId: h.document_id, fileName: h.file_name, ...f.source },
        })),
    );
    let recommendation: { angles: string[]; claimIds: number[] } | undefined;
    try {
      recommendation = await this.models.recommend({
        listing: property,
        evidence: result.hits.slice(0, 6).map((h) => ({ text: h.text_content, source: h.source })),
        claims: candidates.map((c, id) => ({ id, ...c })),
        conflicts,
      });
    } catch {
      /* Keep saved facts available and clearly report analysis unavailable. */
    }
    const claims = [...new Set(recommendation?.claimIds ?? [])]
      .filter((i) => i >= 0 && i < candidates.length)
      .map((i) => ({ ...candidates[i], requiresVerification: true }));
    return {
      analysisAvailable: Boolean(recommendation),
      claims,
      origin: "STRUCTURED_LISTING_FACTS",
      retrievalMode: result.mode,
      objective: "Qualified Leads",
      copy: {
        primaryText: [
          property.title,
          property.city,
          "Harga Rp" + new Intl.NumberFormat("id-ID").format(property.price),
          ...claims.map((c) => c.claim),
        ]
          .filter(Boolean)
          .join(". "),
        headline: property.title,
        cta: property.wa_number ? "WhatsApp" : null,
      },
      sources,
      conflicts,
      warnings: [
        ...(!recommendation
          ? ["Analisis AI belum tersedia. Preview hanya memakai fakta listing."]
          : []),
        ...(conflicts.length
          ? ["Harga dokumen berbeda dari listing. Verifikasi sebelum dipakai dalam iklan."]
          : []),
        "Promo dan masa berlaku perlu diverifikasi sebelum publikasi.",
      ],
      strategy: {
        location: property.city,
        angles: recommendation?.angles ?? [],
        status: "REQUIRES_REVIEW",
      },
    };
  }
  async videos(tenant: string, listing: string) {
    await this.listing(tenant, listing);
    const { data, error } = await this.db
      .from("listing_media_videos")
      .select("id,file_name,storage_key,mime_type,size_bytes")
      .eq("tenant_id", tenant)
      .eq("listing_id", listing);
    if (error) throw new UnavailableError("Video database migration 060 is required");
    return {
      videos: await Promise.all(
        (data ?? []).map(async (v) => {
          const signed = await this.assets?.assetStorage.getSignedUrl(v.storage_key as string, 900);
          return {
            id: v.id,
            fileName: v.file_name,
            sizeBytes: v.size_bytes,
            url: signed?.ok ? signed.value : null,
          };
        }),
      ),
    };
  }
  async uploadVideo(
    tenant: string,
    listing: string,
    file: { buffer: Buffer; fileName: string; mimeType: string },
  ) {
    await this.listing(tenant, listing);
    if (!this.assets) throw new UnavailableError("GCS unavailable");
    if (
      !["video/mp4", "video/quicktime", "video/webm"].includes(file.mimeType) ||
      !file.buffer.length ||
      file.buffer.length > 100 * 1024 * 1024
    )
      throw new ValidationError("Video must be MP4, MOV or WebM, up to 100 MB");
    const count = await this.db
      .from("listing_media_videos")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant)
      .eq("listing_id", listing);
    if (count.error) throw new UnavailableError("Video migration required");
    if ((count.count ?? 0) >= 10) throw new ValidationError("Maximum 10 videos");
    const id = randomUUID(),
      key = "listings/" + tenant + "/" + listing + "/videos/" + id;
    const upload = await this.assets.assetStorage.upload({
      path: key,
      fileBody: file.buffer,
      contentType: file.mimeType,
    });
    if (!upload.ok) throw new UnavailableError("Video upload failed");
    const result = await this.db.from("listing_media_videos").insert({
      id,
      tenant_id: tenant,
      listing_id: listing,
      file_name: file.fileName.slice(0, 255),
      storage_key: key,
      mime_type: file.mimeType,
      size_bytes: file.buffer.length,
    });
    if (result.error) {
      await (this.assets.assetStorage as unknown as StorageDownload)
        .delete(key)
        .catch(() => undefined);
      throw new UnavailableError("Video could not be saved");
    }
    return { id };
  }
  async removeVideo(tenant: string, listing: string, id: string) {
    await this.listing(tenant, listing);
    const { data, error } = await this.db
      .from("listing_media_videos")
      .delete()
      .eq("tenant_id", tenant)
      .eq("listing_id", listing)
      .eq("id", id)
      .select("storage_key");
    if (error) throw new UnavailableError("Video removal failed");
    if (!data?.length) throw new NotFoundError("Video not found");
    if (this.assets)
      await (this.assets.assetStorage as unknown as StorageDownload)
        .delete(data[0]?.storage_key as string)
        .catch(() => undefined);
    return { removed: true };
  }
  private async checkpoint(
    id: string,
    token: string,
    status: string,
    chunks?: unknown[],
    error?: string,
  ) {
    const response = await this.db.rpc("checkpoint_listing_knowledge", {
      p_document: id,
      p_token: token,
      p_status: status,
      p_chunks: chunks ?? null,
      p_error: error ?? null,
    });
    if (response.error || response.data !== true) throw new KnowledgeError("LEASE_LOST");
  }
  @Interval(5000)
  async work() {
    if (this.busy || !this.assets) return;
    this.busy = true;
    let job: { document_id: string; lease_token: string } | undefined;
    try {
      const claim = await this.db.rpc("claim_listing_knowledge_job");
      if (claim.error) return;
      job = (claim.data as { document_id: string; lease_token: string }[])[0];
      if (!job) return;
      const { data, error } = await this.db
        .from("listing_knowledge_documents")
        .select("*")
        .eq("id", job.document_id)
        .eq("is_active", true)
        .single();
      if (error || !data) throw new KnowledgeError("DOCUMENT_UNAVAILABLE");
      const doc = data as KnowledgeDocument;
      const stored = await this.db
        .from("listing_knowledge_chunks")
        .select("*")
        .eq("tenant_id", doc.tenant_id)
        .eq("listing_id", doc.listing_id)
        .eq("document_id", doc.id)
        .order("sequence_no");
      if (stored.error) throw new KnowledgeError("INDEX_UNAVAILABLE");
      let chunks: KnowledgeChunk[];
      if (stored.data?.length) {
        chunks = stored.data.map(
          (c: {
            text_content: string;
            source: KnowledgeChunk["source"];
            sequence_no: number;
            content_hash: string;
            facts: KnowledgeChunk["facts"];
          }) => ({
            text: c.text_content,
            source: c.source,
            sequence: c.sequence_no,
            hash: c.content_hash,
            facts: c.facts,
          }),
        );
      } else {
        await this.checkpoint(doc.id, job.lease_token, "PARSING");
        const download = await (this.assets.assetStorage as unknown as StorageDownload).download(
          doc.storage_key,
        );
        if (!download.ok) throw new KnowledgeError("DOWNLOAD_FAILED");
        if (hashContent(download.value) !== doc.content_hash)
          throw new KnowledgeError("CONTENT_CHANGED");
        const parsed = await parseDocument(download.value, doc.file_name);
        await this.checkpoint(doc.id, job.lease_token, "EXTRACTING");
        chunks = attachDocumentContext(buildChunks(parsed), doc.file_name);
        if (chunks.length > 1000) throw new KnowledgeError("DOCUMENT_TOO_COMPLEX");
        await this.checkpoint(doc.id, job.lease_token, "CHUNKING", chunks);
      }
      for (let index = 0; index < chunks.length; index += 16) {
        const batch = chunks
          .slice(index, index + 16)
          .filter(
            (c) =>
              !stored.data?.some(
                (row: { sequence_no: number; embedding: unknown }) =>
                  row.sequence_no === c.sequence && row.embedding,
              ),
          );
        if (!batch.length) continue;
        await this.checkpoint(doc.id, job.lease_token, "EMBEDDING");
        const vectors = await this.models.embed(batch.map((c) => c.text));
        await this.checkpoint(
          doc.id,
          job.lease_token,
          "INDEXING",
          batch.map((c, i) => ({
            ...c,
            embedding: JSON.stringify(vectors[i]),
            model: "text-embedding-3-small",
          })),
        );
      }
      await this.checkpoint(doc.id, job.lease_token, "READY");
      this.logger.log(
        "Knowledge ingestion completed document=" + doc.id + " chunks=" + chunks.length,
      );
    } catch (error) {
      const code = error instanceof KnowledgeError ? error.code : "INGESTION_FAILED";
      if (job)
        await this.checkpoint(
          job.document_id,
          job.lease_token,
          code === "OCR_REQUIRED" ? "OCR_REQUIRED" : "FAILED",
          undefined,
          code,
        ).catch(() => undefined);
      this.logger.warn("Knowledge ingestion failed: " + code);
    } finally {
      this.busy = false;
    }
  }
}
