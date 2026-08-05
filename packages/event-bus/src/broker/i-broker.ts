import type { IPublisher } from "../publisher/i-publisher.js";
import type { SubscribeInput } from "../subscriber/i-subscriber.js";

/** The Event Bus's public façade — Publisher + Subscriber composed behind one object. */
export interface IEventBroker extends IPublisher {
  subscribe(input: SubscribeInput): string;
  unsubscribe(subscriberId: string): void;
  readonly subscriberCount: number;
}
