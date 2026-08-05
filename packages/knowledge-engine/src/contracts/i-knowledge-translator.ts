/** "IKnowledgeTranslator — No implementation." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md — "AI READY"). Implementation belongs to a future AI Gateway / translation Engineering Task. */
export interface IKnowledgeTranslator {
  translate(text: string, targetLanguage: string): Promise<string>;
}
