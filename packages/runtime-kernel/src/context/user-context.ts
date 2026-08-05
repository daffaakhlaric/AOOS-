/** The human or Agent actor identity for the current unit of execution. */
export interface UserContext {
  readonly userId: string;
  readonly roles?: readonly string[];
}
