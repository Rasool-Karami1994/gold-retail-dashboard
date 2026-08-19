import { env } from "../config/env.js";
import { normalizeMobile } from "../lib/mobile.js";

export interface SmsMessage {
  to: string;
  text: string;
  template?: string;
  variables?: Record<string, string>;
}

export interface SmsResult {
  provider: string;
  messageId?: string;
  text?: string;
}

export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<SmsResult>;
}

export class SmsError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly providerError?: unknown,
  ) {
    super(message);
    this.name = "SmsError";
  }
}

export class MockSmsProvider implements SmsProvider {
  readonly name = "mock";

  constructor() {
    if (env.isProduction && !env.ALLOW_MOCK_SMS_IN_PRODUCTION) {
      throw new Error(
        "MockSmsProvider cannot be used in production -- it does not send " +
          "anything and it exposes OTP codes in API responses. " +
          "Set SMS_PROVIDER=kavenegar, or ALLOW_MOCK_SMS_IN_PRODUCTION=true " +
          "to accept that trade deliberately.",
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

export const ConsoleSmsProvider = MockSmsProvider;

const KAVENEGAR_BASE = "https://api.kavenegar.com/v1";

interface KavenegarResponse {
  return?: { status?: number; message?: string };
  entries?: Array<{ messageid?: number; status?: number; statustext?: string }>;
}

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
    const url = `${KAVENEGAR_BASE}/${this.apiKey}/${path}`;

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
      throw new SmsError(
        this.name,
        `Kavenegar returned a non-JSON response (HTTP ${response.status})`,
        raw.slice(0, 200),
      );
    }

    return body;
  }
}

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
      const unreachable: never = env.SMS_PROVIDER;
      throw new Error(`Unknown SMS provider: ${String(unreachable)}`);
    }
  }
}

let provider: SmsProvider | undefined;

export function getSmsProvider(): SmsProvider {
  provider ??= createProvider();
  return provider;
}

export function setSmsProvider(next: SmsProvider): void {
  provider = next;
}

export function send(mobile: string, message: string): Promise<SmsResult> {
  return getSmsProvider().send({ to: mobile, text: message });
}

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
