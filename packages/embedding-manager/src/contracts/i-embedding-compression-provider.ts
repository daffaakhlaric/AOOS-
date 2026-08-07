/** "IEmbeddingCompressionProvider" — interface ONLY. A caller-supplied vector-compression scheme (e.g. quantization); this package never touches vector bytes. */
export interface IEmbeddingCompressionProvider {
  describe(): Promise<{ readonly algorithm: string; readonly ratio?: number }>;
}
