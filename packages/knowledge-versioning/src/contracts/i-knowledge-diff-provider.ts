/** Interface only — no implementation in this package ("No diff engine."). An external provider that produces an opaque diff artifact between two versions. */
export interface IKnowledgeDiffProvider {
  diff(leftVersionId: string, rightVersionId: string): unknown | Promise<unknown>;
}
