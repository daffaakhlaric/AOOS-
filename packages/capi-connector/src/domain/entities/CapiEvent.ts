import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { ActionSource } from "../value-objects/ActionSource.js";
import type { CurrencyCode } from "../value-objects/CurrencyCode.js";
import type { EventName } from "../value-objects/EventName.js";
import type { EventSourceUrl } from "../value-objects/EventSourceUrl.js";
import type { EventTime } from "../value-objects/EventTime.js";
import type { HashedName } from "../value-objects/HashedName.js";
import type { HashedPhone } from "../value-objects/HashedPhone.js";

export interface CapiEventUserData {
  readonly ph?: readonly HashedPhone[];
  readonly fn?: readonly HashedName[];
  readonly country?: readonly string[];
  /** Always empty for server-side (S2S) CAPI events — no browser making the request. */
  readonly clientUserAgent: string;
}

export interface CapiEventCustomData {
  readonly value?: number;
  readonly currency?: CurrencyCode;
  readonly contentIds?: readonly string[];
  readonly contentType?: string;
}

export interface CapiEventProps {
  readonly eventName: EventName;
  readonly eventTime: EventTime;
  readonly eventSourceUrl: EventSourceUrl;
  readonly actionSource: ActionSource;
  readonly userData: CapiEventUserData;
  readonly customData?: CapiEventCustomData;
  readonly testEventCode?: string;
}

/** Meta CAPI's wire-level event JSON shape (`POST /{pixel-id}/events`'s `data[]` entries). */
export interface CapiEventWireFormat {
  readonly event_name: string;
  readonly event_time: number;
  readonly event_source_url: string;
  readonly action_source: string;
  readonly user_data: {
    readonly ph?: readonly string[];
    readonly fn?: readonly string[];
    readonly country?: readonly string[];
    readonly client_user_agent: string;
  };
  readonly custom_data?: {
    readonly value?: number;
    readonly currency?: string;
    readonly content_ids?: readonly string[];
    readonly content_type?: string;
  };
}

/** One CAPI event, ready to be batched and sent — the domain-level representation, converted to Meta's wire JSON shape only at the infrastructure boundary (`toWireFormat`). */
export class CapiEvent {
  private constructor(private readonly props: CapiEventProps) {}

  static create(props: CapiEventProps): Result<CapiEvent, ValidationError> {
    if (props.customData?.value !== undefined && props.customData.value < 0) {
      return err(new ValidationError("CapiEvent.customData.value must not be negative"));
    }
    return ok(new CapiEvent({ ...props }));
  }

  get eventName(): EventName {
    return this.props.eventName;
  }

  get eventTime(): EventTime {
    return this.props.eventTime;
  }

  get customData(): CapiEventCustomData | undefined {
    return this.props.customData;
  }

  toWireFormat(): CapiEventWireFormat {
    const wire: CapiEventWireFormat = {
      event_name: this.props.eventName,
      event_time: this.props.eventTime.value,
      event_source_url: this.props.eventSourceUrl.toString(),
      action_source: this.props.actionSource.toString(),
      user_data: {
        ph: this.props.userData.ph?.map((h) => h.value),
        fn: this.props.userData.fn?.map((h) => h.value),
        country: this.props.userData.country,
        client_user_agent: this.props.userData.clientUserAgent,
      },
    };
    if (this.props.customData === undefined) {
      return wire;
    }
    return {
      ...wire,
      custom_data: {
        value: this.props.customData.value,
        currency: this.props.customData.currency?.toString(),
        content_ids: this.props.customData.contentIds,
        content_type: this.props.customData.contentType,
      },
    };
  }
}
