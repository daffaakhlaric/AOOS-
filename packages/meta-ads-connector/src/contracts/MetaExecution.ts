export interface CampaignDestinationContext {
  readonly tenantId: string;
  readonly integrationId: string;
  readonly adAccountId: string;
  readonly pageId: string;
  readonly destinationType: "WHATSAPP" | "WEBSITE" | "LEAD_FORM";
  readonly whatsappNumberId?: string;
  readonly websiteUrl?: string;
  readonly instagramAccountId?: string;
  readonly objective: string;
  readonly approvedAtVersion: number;
}
export interface MetaWriteReceipt {
  readonly provider: "META";
  readonly operation: string;
  readonly requestId?: string;
  readonly providerObjectId?: string;
  readonly submittedAt: string;
  readonly responseStatus: number;
  readonly normalizedResult: "ACCEPTED_UNVERIFIED";
  readonly verificationRequired: true;
}
export type VerificationStatus =
  "VERIFIED" | "MISMATCH" | "NOT_FOUND" | "UNCERTAIN" | "PERMISSION_BLOCKED";
export interface MetaVerificationResult {
  readonly status: VerificationStatus;
  readonly mismatchedFields: readonly string[];
  readonly observed?: Readonly<Record<string, unknown>>;
}
