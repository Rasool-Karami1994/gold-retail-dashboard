import { env } from "../config/env.js";
import { normalizeMobile } from "../lib/mobile.js";

/**
 * SMS delivery.
 *
 * Callers depend on the `SmsProvider` interface only, so swapping gateways is
 * one new class plus a case in `createProvider` -- no controller or service
 * changes.
 *
 * WHY fetch AND NOT THE OFFICIAL SDK
 * ----------------------------------
 * The `kavenegar` npm package is at 1.1.4, last published June 2022. It is
 * callback-based, ships no types, and wraps two URL builds. Node has had a
 * global fetch for years, so the SDK would add a stale dependency and a
 * promisify layer to save roughly fifteen lines. If it starts moving again,
 * the provider below is the only file that would change.
 */

/* -------------------------------------------------------------------------- */
/* Interface                                                                   */
/* -------------------------------------------------------------------------- */

export interface SmsMessage {
  /** Recipient. Normalised to `09XXXXXXXXX` before sending. */
  to: string;
  text: string;
  /**
   * Pre-approved template name.
   *
   * Iranian gateways will not deliver one-time codes over a normal sending
   * line -- OTP traffic has to go through an approved template, which is a
   * different endpoint (see KavenegarSmsProvider). When this is set the
   * provider uses that path and `text` is only a fallback for stubs.
   */
  template?: string;
  /** Values substituted into `template`. */
  variables?: Record<string, string>;
}

export interface SmsResult {
  provider: string;
  messageId?: string;
  /**
   * The rendered message, returned ONLY by the mock provider.
   *
   * A real gateway has no reason to hand the text back -- the caller wrote it.
   * The mock does, because nothing was delivered and the only way to complete a
   * flow locally is to read the code or link off the screen. Callers must treat
   * its presence as "we are in mock mode", never assume it.
   */
  text?: string;
}

export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<SmsResult>;
}

/** Thrown when a provider rejects or cannot be reached. */
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

/* -------------------------------------------------------------------------- */
/* Mock stub                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Development stub: prints the message instead of sending it, and hands the
 * text back so the caller can show it on screen.
 *
 * !! THIS PUTS ONE-TIME CODES IN API RESPONSES. !!
 *
 * That is the point -- without a gateway there is no other way to finish a
 * login -- and it is why it is only acceptable on a developer's machine or a
 * trusted MVP demo. Anyone who can see the response can sign in as any customer
 * whose number they know, so the OTP stops being a second factor and becomes
 * decoration. Switch SMS_PROVIDER to `kavenegar` before a single real customer
 * depends on it for account security.
 *
 * The production guard below is the backstop: this refuses to load at all when
 * NODE_ENV=production, so the leak cannot ship by forgetting an env var.
 * Silently "succeeding" without delivering would also make every customer login
 * fail in a way that looks like a client bug.
 */
export class MockSmsProvider implements SmsProvider {
  readonly name = "mock";

  constructor() {
    if (env.isProduction) {
      throw new Error(
        "MockSmsProvider cannot be used in production -- it does not send " +
          "anything and it exposes OTP codes in API responses. " +
          "Set SMS_PROVIDER=kavenegar.",
      );
    }
  }

  async send(message: SmsMessage): Promise<SmsResult> {
    const messageId = `mock-${Date.now().toString(36)}`;

    console.log(
      [
        "",
        "┌─ SMS (not actually sent) ──────────────────────────",
        `│ to:   ${message.to}`,
        `│ text: ${message.text}`,
        ...(message.template ? [`│ tmpl: ${message.template}`] : []),
        `│ id:   ${messageId}`,
        "└────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );

    return { messageId, provider: this.name, text: message.text };
  }
}

/**
 * @deprecated Renamed to MockSmsProvider. Kept so `SMS_PROVIDER=console` in an
 * existing .env keeps resolving; env.ts folds that value into `mock`.
 */
export const ConsoleSmsProvider = MockSmsProvider;

/* -------------------------------------------------------------------------- */
/* Kavenegar                                                                   */
/* -------------------------------------------------------------------------- */

const KAVENEGAR_BASE = "https://api.kavenegar.com/v1";

/** Kavenegar answers 200 with the real outcome in `return.status`. */
interface KavenegarResponse {
  return?: { status?: number; message?: string };
  entries?: Array<{ messageid?: number; status?: number; statustext?: string }>;
}

/**
 * Statuses worth naming, because the generic message Kavenegar returns for
 * them is not actionable on its own.
 */
const KAVENEGAR_HINTS: Record<number, string> = {
  400: "bad parameters",
  401: "account is disabled",
  402: "operation failed",
  403: "invalid API key",
  411: "recipient is invalid or blocked",
  412: "sender line is invalid or not owned by this account",
  414: "too many recipients in one request",
  418: "insufficient credit",
  424: "template not found -- check KAVENEGAR template approval",
  426: "this feature requires a paid plan",
  428: "sending to this recipient is not permitted",
};

export class KavenegarSmsProvider implements SmsProvider {
  readonly name = "kavenegar";

  constructor(
    private readonly apiKey: string,
    private readonly sender: string | undefined,
    private readonly timeoutMs = 10_000,
  ) {
    if (!apiKey) {
      throw new Error("KAVENEGAR_API_KEY is required when SMS_PROVIDER=kavenegar");
    }
  }

  async send(message: SmsMessage): Promise<SmsResult> {
    const to = normalizeMobile(message.to) || message.to;

    // Templated messages (OTP) must go through verify/lookup: a regular
    // sending line will not deliver a one-time code, and the request is
    // rejected or silently filtered.
    const { path, params } = message.template
      ? this.buildLookup(to, message)
      : this.buildSend(to, message);

    const body = await this.request(path, params);
    const status = body.return?.status;

    if (status !== 200) {
      const hint = status ? KAVENEGAR_HINTS[status] : undefined;
      throw new SmsError(
        this.name,
        `Kavenegar rejected the message (status ${status ?? "unknown"}${
          hint ? `: ${hint}` : ""
        })`,
        // The gateway's own message, never the request URL -- it carries the
        // API key in its path.
        body.return?.message,
      );
    }

    const messageId = body.entries?.[0]?.messageid;
    return { provider: this.name, messageId: messageId?.toString() };
  }

  private buildLookup(to: string, message: SmsMessage) {
    const params = new URLSearchParams({
      receptor: to,
      template: message.template as string,
    });

    // verify/lookup takes positional tokens, not named ones: token, token2,
    // token3... and none of them may contain a space.
    const values = Object.values(message.variables ?? {});
    values.forEach((value, index) => {
      params.set(index === 0 ? "token" : `token${index + 1}`, value);
    });

    return { path: "verify/lookup.json", params };
  }

  private buildSend(to: string, message: SmsMessage) {
    const params = new URLSearchParams({
      receptor: to,
      message: message.text,
    });
    if (this.sender) params.set("sender", this.sender);

    return { path: "sms/send.json", params };
  }

  private async request(
    path: string,
    params: URLSearchParams,
  ): Promise<KavenegarResponse> {
    // The API key sits in the URL path, so this URL must never be logged.
    const url = `${KAVENEGAR_BASE}/${this.apiKey}/${path}`;

    // Without a timeout a hung gateway would hold an OTP request open until
    // the client gives up.
    const signal = AbortSignal.timeout(this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: params.toString(),
        signal,
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      throw new SmsError(
        this.name,
        timedOut
          ? `Kavenegar did not respond within ${this.timeoutMs}ms`
          : "Could not reach Kavenegar",
        error,
      );
    }

    const raw = await response.text();

    let body: KavenegarResponse;
    try {
      body = JSON.parse(raw) as KavenegarResponse;
    } catch {
      // An HTML error page or a captive portal -- include a short excerpt, not
      // the whole body.
      throw new SmsError(
        this.name,
        `Kavenegar returned a non-JSON response (HTTP ${response.status})`,
        raw.slice(0, 200),
      );
    }

    return body;
  }
}

/* -------------------------------------------------------------------------- */
/* Factory                                                                     */
/* -------------------------------------------------------------------------- */

function createProvider(): SmsProvider {
  switch (env.SMS_PROVIDER) {
    case "mock":
      return new MockSmsProvider();
    case "kavenegar":
      return new KavenegarSmsProvider(
        env.KAVENEGAR_API_KEY ?? "",
        env.KAVENEGAR_SENDER,
      );
    default: {
      // Exhaustiveness guard: extending the enum without a case fails to build.
      const unreachable: never = env.SMS_PROVIDER;
      throw new Error(`Unknown SMS provider: ${String(unreachable)}`);
    }
  }
}

let provider: SmsProvider | undefined;

/** Lazily constructed, so importing this module has no side effects. */
export function getSmsProvider(): SmsProvider {
  provider ??= createProvider();
  return provider;
}

/** Test seam: inject a fake provider. */
export function setSmsProvider(next: SmsProvider): void {
  provider = next;
}

/**
 * The plain interface the brief asks for. Equivalent to
 * `getSmsProvider().send({ to, text })`, and the right entry point when there
 * is no template involved.
 */
export function send(mobile: string, message: string): Promise<SmsResult> {
  return getSmsProvider().send({ to: mobile, text: message });
}

/**
 * Sends without ever throwing.
 *
 * For call sites where delivery is a side effect of something that already
 * succeeded -- an invoice is rendered, a sale is recorded -- and where letting
 * a gateway outage roll back real work would be worse than a customer not
 * getting a text. Returns whether it went out, so the caller can still act on
 * it.
 */
export async function trySend(
  mobile: string,
  message: string,
  context: string,
): Promise<boolean> {
  try {
    await send(mobile, message);
    return true;
  } catch (error) {
    console.error(`[sms] ${context}: delivery to ${mobile} failed:`, error);
    return false;
  }
}
