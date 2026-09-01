import "@fastify/multipart";

import { ValidationError } from "@aos/errors";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  CreateListingBodySchema,
  GetListingsQuerySchema,
  ReorderPhotosBodySchema,
  UpdateListingBodySchema,
  type CreateListingBodyDto,
  type GetListingsQueryDto,
  type ListingListResponseDto,
  type ListingResponseDto,
  type ReorderPhotosBodyDto,
  type UpdateListingBodyDto,
} from "./dto/listing.dto.js";
import { ListingsService } from "./listings.service.js";

/**
 * `GET/POST /api/v1/listings`, `GET/PUT/DELETE /api/v1/listings/:id`,
 * `POST /:id/photos`, `DELETE /:id/photos/:photoId`, `PUT /:id/photos/reorder`,
 * `POST /:id/documents`, `DELETE /:id/documents/:documentId` (Phase 2 — PDF/Excel/promo docs),
 * `POST /:id/publish-knowledge` — `x-api-key` auth (same perimeter as every other `aaos-api`
 * module), tenant-scoped via `@TenantId()` (`common/tenant-context.ts`).
 *
 * `stats`-style fixed segments aren't needed here (no `GET /api/v1/listings/stats` route), so no
 * route-ordering hazard like `AssetsController`'s `stats`-before-`:id` — every `:id`-prefixed route
 * below is still declared before the bare `:id` route for the same defensive reason.
 */
@Controller("api/v1/listings")
@UseGuards(ApiKeyGuard)
export class ListingsController {
  constructor(private readonly service: ListingsService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(GetListingsQuerySchema)) query: GetListingsQueryDto,
  ): Promise<ListingListResponseDto> {
    return this.service.list(tenantId, query);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(CreateListingBodySchema)) body: CreateListingBodyDto,
  ): Promise<ListingResponseDto> {
    return this.service.create(tenantId, body);
  }

  /**
   * `multipart/form-data`: one `file` part (the photo bytes) plus an optional `label` field
   * (spec Part 4's "label per foto"). Uses `@fastify/multipart`'s stream-mode `request.file()`
   * directly — Nest has no built-in multipart decorator for Fastify, and this app's real
   * `create-app.ts` registers the plugin globally (see that file's docstring) rather than
   * inventing a second body-parsing path.
   */
  @Post(":id/photos")
  async uploadPhoto(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Req() request: FastifyRequest,
  ): Promise<ListingResponseDto> {
    const part = await request.file();
    if (part === undefined) {
      throw new ValidationError("POST /:id/photos requires a multipart 'file' part");
    }
    const buffer = await part.toBuffer();
    const labelField = part.fields["label"];
    const label =
      labelField !== undefined && !Array.isArray(labelField) && labelField.type === "field"
        ? String(labelField.value)
        : undefined;
    return this.service.addPhoto(tenantId, id, {
      buffer,
      fileName: part.filename,
      mimeType: part.mimetype,
      ...(label !== undefined && label.length > 0 ? { label } : {}),
    });
  }

  @Delete(":id/photos/:photoId")
  @HttpCode(200)
  async deletePhoto(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Param("photoId") photoId: string,
  ): Promise<ListingResponseDto> {
    return this.service.deletePhoto(tenantId, id, photoId);
  }

  /**
   * `multipart/form-data`: one `file` part (the document bytes — PDF/Excel) plus an optional
   * `label` field, exact same real Fastify multipart shape as `uploadPhoto` above.
   */
  @Post(":id/documents")
  async uploadDocument(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Req() request: FastifyRequest,
  ): Promise<ListingResponseDto> {
    const part = await request.file();
    if (part === undefined) {
      throw new ValidationError("POST /:id/documents requires a multipart 'file' part");
    }
    const buffer = await part.toBuffer();
    const labelField = part.fields["label"];
    const label =
      labelField !== undefined && !Array.isArray(labelField) && labelField.type === "field"
        ? String(labelField.value)
        : undefined;
    return this.service.addDocument(tenantId, id, {
      buffer,
      fileName: part.filename,
      mimeType: part.mimetype,
      ...(label !== undefined && label.length > 0 ? { label } : {}),
    });
  }

  @Delete(":id/documents/:documentId")
  @HttpCode(200)
  async deleteDocument(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Param("documentId") documentId: string,
  ): Promise<ListingResponseDto> {
    return this.service.deleteDocument(tenantId, id, documentId);
  }

  @Put(":id/photos/reorder")
  async reorderPhotos(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ReorderPhotosBodySchema)) body: ReorderPhotosBodyDto,
  ): Promise<ListingResponseDto> {
    return this.service.reorderPhotos(tenantId, id, body);
  }

  @Post(":id/publish-knowledge")
  @HttpCode(200)
  async publishKnowledge(
    @TenantId() tenantId: string,
    @Param("id") id: string,
  ): Promise<ListingResponseDto> {
    return this.service.publishKnowledge(tenantId, id);
  }

  @Get(":id")
  async byId(@TenantId() tenantId: string, @Param("id") id: string): Promise<ListingResponseDto> {
    return this.service.getById(tenantId, id);
  }

  @Put(":id")
  async update(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateListingBodySchema)) body: UpdateListingBodyDto,
  ): Promise<ListingResponseDto> {
    return this.service.update(tenantId, id, body);
  }

  @Delete(":id")
  @HttpCode(200)
  async remove(
    @TenantId() tenantId: string,
    @Param("id") id: string,
  ): Promise<{ readonly deleted: true }> {
    await this.service.delete(tenantId, id);
    return { deleted: true };
  }
}
