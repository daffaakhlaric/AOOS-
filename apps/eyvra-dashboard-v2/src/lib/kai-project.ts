/** Persisted handoff projection. Server owns tenant, project identity and brief revisions. */
export interface KaiPersistedConcept {
  productionPipeline?: {
    id: string;
    label: string;
    reason: string;
    stages: string[];
    costStatus: string;
  };
  id: string;
  title: string;
  family: string;
  hypothesis: string;
  persona: string;
  visualDirection: string;
  format: "IMAGE" | "VIDEO" | "CAROUSEL";
  sourceUrls: string[];
  storyboard: {
    revision: number;
    data: {
      scenes: {
        id: string;
        purpose: string;
        visualDirection: string;
        sourceUrl: string;
        overlayText: string;
        startSeconds: number | null;
        endSeconds: number | null;
        provenance: { sourceLocator: string };
      }[];
    };
  };
}
export interface KaiProjectDetail {
  project: {
    id: string;
    campaign_draft_id: string;
    creative_brief_id: string;
    status: string;
    created_at: string;
    updated_at: string;
  };
  brief: {
    briefId: string;
    campaignDraftId: string;
    listingId?: string;
    objective: string;
    optimizationGoal: string;
    targetAudience: {
      segments: string[];
      geo: { name: string; radiusKm?: number }[];
      buyerIntent: string[];
      validationStatus: string;
    };
    personas: string[];
    tone: string;
    CTA: { label: string; destination: string; destinationType: string };
    formats: { type: "IMAGE" | "VIDEO" | "CAROUSEL"; quantity: number; aspectRatios: string[] }[];
    conceptCount: number;
    offer: { primaryOffer?: string; price?: number };
    creativeStrategy: {
      primaryAngles: string[];
      secondaryAngles: string[];
      preserve: string[];
      avoid: string[];
      explore: string[];
    };
    factualClaims: { text: string; sourceId: string; sourceLocator: string; sourceType: string }[];
    brandRules: string[];
    knowledgeSourceIds: string[];
    createdBy: string;
    strategyMethod: string;
    simulationPolicy: string;
  };
}
