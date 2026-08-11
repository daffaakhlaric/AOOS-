import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

export interface WebhookVerificationProps {
  readonly mode: string;
  readonly challenge: string;
  readonly verifiedAt: Date;
}

/**
 * The successful outcome of a `hub.verify_token` GET handshake — constructed only once
 * `VerifyWebhook` has confirmed the caller's token matches the configured
 * `webhookVerifyToken`. Carries just enough to answer "what challenge do we echo back, and when
 * did we verify it" without re-deriving `WebhookVerifier`'s own comparison logic.
 */
export class WebhookVerification {
  private constructor(private readonly props: WebhookVerificationProps) {}

  static create(props: WebhookVerificationProps): Result<WebhookVerification, ValidationError> {
    if (props.mode !== "subscribe") {
      return err(
        new ValidationError(
          `WebhookVerification.mode must be "subscribe", received: ${String(props.mode)}`,
        ),
      );
    }
    if (typeof props.challenge !== "string" || props.challenge.length === 0) {
      return err(new ValidationError("WebhookVerification.challenge must be a non-empty string"));
    }
    return ok(new WebhookVerification({ ...props }));
  }

  get mode(): string {
    return this.props.mode;
  }

  get challenge(): string {
    return this.props.challenge;
  }

  get verifiedAt(): Date {
    return this.props.verifiedAt;
  }
}
