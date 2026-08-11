import type { Lead } from "../domain/entities/Lead.js";

/** A live handle to a Supabase Realtime channel subscription — returned by `SubscribeToHotLeads`. */
export interface IRealtimeSubscription {
  readonly channelName: string;
  onHotLead(callback: (lead: Lead) => void): void;
  unsubscribe(): Promise<void>;
}
