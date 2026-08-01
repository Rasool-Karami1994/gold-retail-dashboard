import { env } from "../../config/env.js";
import { ConsoleSmsProvider } from "./console.provider.js";
import type { SmsProvider } from "./types.js";

export type { SmsMessage, SmsProvider, SmsResult } from "./types.js";
export { SmsError } from "./types.js";

/**
 * Resolves the provider named by `SMS_PROVIDER`.
 *
 * To add a real gateway:
 *   1. implement SmsProvider in ./<name>.provider.ts
 *   2. add "<name>" to the SMS_PROVIDER enum in config/env.ts
 *   3. add a case here
 * Nothing else changes -- callers only ever see `getSmsProvider()`.
 */
function createSmsProvider(): SmsProvider {
  switch (env.SMS_PROVIDER) {
    case "console":
      return new ConsoleSmsProvider();
    default: {
      // Exhaustiveness guard: adding to the enum without a case fails to compile.
      const unreachable: never = env.SMS_PROVIDER;
      throw new Error(`Unknown SMS provider: ${String(unreachable)}`);
    }
  }
}

let provider: SmsProvider | undefined;

/** Lazily constructed so importing this module never has side effects. */
export function getSmsProvider(): SmsProvider {
  provider ??= createSmsProvider();
  return provider;
}

/** Test seam: inject a fake provider. */
export function setSmsProvider(next: SmsProvider): void {
  provider = next;
}
