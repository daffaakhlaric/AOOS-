/**
 * Signature Interface (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md — "SECURITY").
 * Interface only — no implementation ships in this package. Lets a future integration
 * sign/verify a serialized Workflow Definition for supply-chain integrity (e.g. before
 * accepting an imported definition from an untrusted source) without this package
 * depending on any specific crypto library.
 */
export interface ISignatureProvider {
  sign(payload: string): Promise<string> | string;
  verify(payload: string, signature: string): Promise<boolean> | boolean;
}
