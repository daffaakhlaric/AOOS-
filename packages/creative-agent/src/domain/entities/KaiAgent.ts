export interface KaiAgentProps {
  readonly name: "Kai";
  readonly tenantId: string;
}

/**
 * The agent itself — Kai's identity (spec Mission: "Build Kai — the AAOS Creative AI Agent"). A
 * thin, stateless identity value (Agent Standards §11.4: agents hold no in-process state across
 * invocations), mirroring `@aos/sales-agent`'s `JessyAgent`. Kai is tenant-scoped, not
 * branch-scoped — a single Kai instance generates creative for every branch's `CreativeBrief`s.
 */
export class KaiAgent {
  private constructor(private readonly props: KaiAgentProps) {}

  static create(tenantId: string): KaiAgent {
    return new KaiAgent({ name: "Kai", tenantId });
  }

  get name(): "Kai" {
    return this.props.name;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }
}
