import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { GoldenConversationSaved } from "./GoldenConversationSaved.js";
import type { JudgementCompleted } from "./JudgementCompleted.js";
import type { VersionCompared } from "./VersionCompared.js";

/**
 * Wraps the real `@aos/event-bus` `IPublisher` for this package's 3 named events, mirroring
 * `@aos/conversation-simulator`'s `SimulatorEvents` / `@aos/sales-agent`'s `ClaraAgentEvents`
 * convention exactly.
 */
export class AiJudgeEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "@aos/ai-judge",
  ) {}

  async publishJudgementCompleted(payload: JudgementCompleted): Promise<void> {
    await this.publish(
      "aaos.judge.judgement.completed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishGoldenConversationSaved(payload: GoldenConversationSaved): Promise<void> {
    await this.publish(
      "aaos.judge.golden-conversation.saved",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  async publishVersionCompared(payload: VersionCompared): Promise<void> {
    await this.publish(
      "aaos.judge.version.compared",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  private async publish<T>(
    type: string,
    payload: T,
    tenantId: string,
    correlationId: string,
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.DOMAIN,
      payload,
      source: this.source,
      producer: "@aos/ai-judge",
      tenantId,
      correlationId,
      version: "1.0.0",
    });
  }
}
