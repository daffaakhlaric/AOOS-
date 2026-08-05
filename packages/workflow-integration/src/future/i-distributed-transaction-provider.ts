/** "Distributed Transaction Provider — No implementation." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md — "FUTURE READY"). */
export interface IDistributedTransactionProvider {
  begin(): Promise<string>;
  commit(transactionId: string): Promise<void>;
  rollback(transactionId: string): Promise<void>;
}
