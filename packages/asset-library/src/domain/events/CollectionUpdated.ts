/** Payload for `aaos.assets.collection.updated` — emitted by `SaveAiCreative` once per saved collection (video + images). */
export interface CollectionUpdated {
  readonly assetIds: readonly string[];
  readonly creativeBriefId?: string;
  readonly unitId?: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: string;
}
