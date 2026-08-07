/** "IEmbeddingEncryptionProvider" — interface ONLY. A caller-supplied at-rest/in-transit encryption scheme for stored vectors; this package never touches vector bytes. */
export interface IEmbeddingEncryptionProvider {
  describe(): Promise<{ readonly algorithm: string; readonly keyReference?: string }>;
}
