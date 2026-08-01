/**
 * The seam between "we need to send a text" and "which company sends it".
 *
 * Callers depend on this interface only, so swapping the console stub for
 * Kavenegar / Ghasedak / Twilio means writing one new file and changing
 * `SMS_PROVIDER` in the environment -- no controller or service changes.
 */

export interface SmsMessage {
  /** Recipient in canonical `09XXXXXXXXX` form. */
  to: string;
  text: string;
  /**
   * Optional provider-side template id. Iranian gateways generally require
   * pre-approved templates for OTP traffic rather than free-form text, so
   * real implementations will use this and may ignore `text`.
   */
  template?: string;
  /** Values substituted into `template`, when the provider supports it. */
  variables?: Record<string, string>;
}

export interface SmsResult {
  /** Provider's message id, when it returns one. */
  messageId?: string;
  provider: string;
}

export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<SmsResult>;
}

/** Thrown when a provider rejects or fails to deliver. */
export class SmsError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    // Not named `cause` -- that would shadow the built-in Error.cause.
    readonly providerError?: unknown,
  ) {
    super(message);
    this.name = "SmsError";
  }
}
