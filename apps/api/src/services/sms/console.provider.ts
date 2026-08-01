import type { SmsMessage, SmsProvider, SmsResult } from "./types.js";
import { env } from "../../config/env.js";

/**
 * Development stub: prints the message instead of sending it, so the OTP flow
 * is exercisable without an SMS account.
 *
 * It refuses to run in production. Silently "succeeding" without delivering
 * anything would make every customer login fail in a way that looks like a
 * client bug -- better to fail at boot.
 */
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = "console";

  constructor() {
    if (env.isProduction) {
      throw new Error(
        "ConsoleSmsProvider cannot be used in production -- it does not send anything. " +
          "Set SMS_PROVIDER to a real provider.",
      );
    }
  }

  async send(message: SmsMessage): Promise<SmsResult> {
    const messageId = `console-${Date.now().toString(36)}`;

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

    return { messageId, provider: this.name };
  }
}
