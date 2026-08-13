/** Payload for `aaos.creative-connector.file.uploaded`, emitted once per successful `FileUploadService.upload()` call. */
export interface FileUploaded {
  readonly fileId: string;
  readonly fileUrl: string;
  readonly fileName: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
