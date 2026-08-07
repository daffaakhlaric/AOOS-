/**
 * "GENERATION PROVIDERS: Support interface metadata for OpenAI, Claude, Gemini, Ollama,
 * Azure OpenAI, AWS Bedrock, Vertex AI, OpenRouter, LiteLLM, Custom Provider. Never
 * implement provider logic." (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md) — the exact 10
 * Generation Providers. This package ships ZERO implementations for any of them; the
 * enum is only a metadata tag identifying which caller-registered
 * `IKnowledgeGenerationProvider` handles a given `KnowledgeGenerationProviderType`.
 */
export enum KnowledgeGenerationProviderType {
  OPENAI = "openai",
  CLAUDE = "claude",
  GEMINI = "gemini",
  OLLAMA = "ollama",
  AZURE_OPENAI = "azure_openai",
  AWS_BEDROCK = "aws_bedrock",
  VERTEX_AI = "vertex_ai",
  OPENROUTER = "openrouter",
  LITELLM = "litellm",
  CUSTOM_PROVIDER = "custom_provider",
}
