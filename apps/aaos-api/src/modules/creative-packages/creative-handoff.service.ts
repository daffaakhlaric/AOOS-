import { createHash, randomUUID } from "node:crypto";

import { BadRequestException, Injectable } from "@nestjs/common";

import { ListingsService } from "../listings/listings.service.js";
import { MetaLeadDestinationsService } from "../listings/meta-lead-destinations.service.js";

import { buildListingCreativeBrief } from "./domain/listing-creative-brief.js";
import type { SaveCampaignDraft } from "./dto/campaign-draft.dto.js";
import {
  CreativeHandoffRepository,
  type HandoffRecord,
} from "./infrastructure/creative-handoff.repository.js";

/** Coordinates existing listing strategy and creative persistence; never calls a paid provider. */
@Injectable()
export class CreativeHandoffService {
  constructor(
    private readonly repository: CreativeHandoffRepository,
    private readonly listings: ListingsService,
    private readonly destinations: MetaLeadDestinationsService,
  ) {}

  async save(tenantId: string, draft: SaveCampaignDraft) {
    const listing = await this.listings.getById(tenantId, draft.listingId);
    if (draft.metaDestination) {
      const assets = await this.destinations.list(tenantId);
      const destination = draft.metaDestination;
      const digits = (value: string) => value.replace(/\D/g, "");
      if (
        assets.adAccountId !== destination.adAccountId ||
        !assets.pages.some((p) => p.id === destination.pageId) ||
        (destination.number &&
          !assets.whatsappNumbers.some(
            (n) => digits(n.displayNumber) === digits(destination.number),
          ))
      ) {
        throw new BadRequestException(
          "Destination Meta berubah atau tidak valid. Muat ulang aset.",
        );
      }
    }
    const result = buildListingCreativeBrief(tenantId, randomUUID(), draft, listing);
    let hash: string | null = null;
    if (result.status === "READY") {
      const { briefId: _briefId, ...content } = result.brief;
      hash = createHash("sha256").update(JSON.stringify(content)).digest("hex");
    }
    return this.present(
      await this.repository.save(
        tenantId,
        draft,
        result.status === "READY" ? result.brief : null,
        hash,
        result.missingFields,
      ),
    );
  }

  async get(tenantId: string, id: string) {
    return this.present(await this.repository.getDraft(tenantId, id));
  }

  listProjects(tenantId: string) {
    return this.repository.listProjects(tenantId);
  }

  async project(tenantId: string, id: string) {
    const { project, brief } = await this.repository.getProject(tenantId, id);
    const { tenant_id: _projectTenant, ...safeProject } = project;
    const { tenantId: _briefTenant, ...safeBrief } = brief;
    return { project: safeProject, brief: safeBrief };
  }

  private present({ draft, project }: HandoffRecord) {
    return {
      ...draft.data,
      revision: draft.revision,
      updatedAt: draft.updated_at,
      status: draft.status,
      missingFields: draft.missing_fields,
      kaiProjectId: project?.id ?? null,
      kaiBriefId: project?.creative_brief_id ?? null,
    };
  }
}
