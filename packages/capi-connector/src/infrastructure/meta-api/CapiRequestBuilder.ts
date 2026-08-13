import type { CapiConnectorConfig } from "../../config/CapiConnectorConfig.js";
import type { CapiBatch } from "../../domain/entities/CapiBatch.js";
import type { CapiEventWireFormat } from "../../domain/entities/CapiEvent.js";

export interface SendEventsRequestBody {
  readonly data: readonly CapiEventWireFormat[];
  readonly access_token: string;
  readonly test_event_code?: string;
}

/** Builds Meta CAPI request URLs and bodies — `access_token` always travels in the body, never a header (Meta's own contract). */
export class CapiRequestBuilder {
  static eventsUrl(config: CapiConnectorConfig): string {
    return `${config.baseUrl}/${config.apiVersion}/${config.pixelId}/events`;
  }

  static eventsBody(batch: CapiBatch, config: CapiConnectorConfig): SendEventsRequestBody {
    const body: SendEventsRequestBody = {
      data: batch.events.map((event) => event.toWireFormat()),
      access_token: config.accessToken,
    };
    if (config.testEventCode === undefined) {
      return body;
    }
    return { ...body, test_event_code: config.testEventCode };
  }

  /** Diagnostics endpoint used to recover the pixel's current Event Match Quality score. */
  static emqUrl(config: CapiConnectorConfig): string {
    const params = new URLSearchParams({
      fields: "server_events_metrics",
      access_token: config.accessToken,
    });
    return `${config.baseUrl}/${config.apiVersion}/${config.pixelId}?${params.toString()}`;
  }
}
