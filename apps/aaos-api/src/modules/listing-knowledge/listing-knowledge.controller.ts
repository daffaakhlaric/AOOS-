import "@fastify/multipart";
import { ValidationError } from "@aos/errors";
import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { TenantId } from "../../common/tenant-context.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { DOCUMENT_FORMATS, MAX_DOCUMENT_BYTES } from "./knowledge.types.js";
import { ListingKnowledgeService } from "./listing-knowledge.service.js";
@Controller("api/v1/listing-knowledge")
@UseGuards(ApiKeyGuard)
export class ListingKnowledgeController {
  constructor(private readonly service: ListingKnowledgeService) {}
  @Get("config") config() {
    return { formats: DOCUMENT_FORMATS, maxBytes: MAX_DOCUMENT_BYTES, maxDocuments: 20 };
  }
  @Get(":listing") list(@TenantId() t: string, @Param("listing") l: string) {
    return this.service.list(t, l);
  }
  @Post(":listing") async upload(
    @TenantId() t: string,
    @Param("listing") l: string,
    @Req() request: FastifyRequest,
  ) {
    const file = await request.file({ limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 } });
    if (!file) throw new ValidationError("File required");
    const buffer = await file.toBuffer();
    return this.service.upload(t, l, { buffer, fileName: file.filename, mimeType: file.mimetype });
  }
  @Delete(":listing/:document") remove(
    @TenantId() t: string,
    @Param("listing") l: string,
    @Param("document") d: string,
  ) {
    return this.service.remove(t, l, d);
  }
  @Post(":listing/:document/retry") retry(
    @TenantId() t: string,
    @Param("listing") l: string,
    @Param("document") d: string,
  ) {
    return this.service.retry(t, l, d);
  }
  @Get(":listing/videos") videos(@TenantId() t: string, @Param("listing") l: string) {
    return this.service.videos(t, l);
  }
  @Post(":listing/videos") async uploadVideo(
    @TenantId() t: string,
    @Param("listing") l: string,
    @Req() request: FastifyRequest,
  ) {
    const file = await request.file({ limits: { fileSize: 100 * 1024 * 1024, files: 1 } });
    if (!file) throw new ValidationError("File required");
    return this.service.uploadVideo(t, l, {
      buffer: await file.toBuffer(),
      fileName: file.filename,
      mimeType: file.mimetype,
    });
  }
  @Delete(":listing/videos/:id") removeVideo(
    @TenantId() t: string,
    @Param("listing") l: string,
    @Param("id") id: string,
  ) {
    return this.service.removeVideo(t, l, id);
  }
  @Post(":listing/search") search(
    @TenantId() t: string,
    @Param("listing") l: string,
    @Body() body: { query?: unknown },
  ) {
    if (typeof body?.query !== "string") throw new ValidationError("Query required");
    return this.service.retrieve(t, l, body.query);
  }
  @Post(":listing/analyze") analyze(@TenantId() t: string, @Param("listing") l: string) {
    return this.service.analyze(t, l);
  }
}
