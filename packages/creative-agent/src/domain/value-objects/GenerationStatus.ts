/** The lifecycle of one `GenerationJob` / `CreativePackage` (spec "Domain — value-objects/GenerationStatus.ts"). */
export enum GenerationStatus {
  PENDING = "PENDING",
  GENERATING = "GENERATING",
  READY = "READY",
  FAILED = "FAILED",
}
