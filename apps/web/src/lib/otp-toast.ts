import { toast } from "@/components/ui";

/**
 * Tells the user a code was sent -- or, when SMS is mocked, what it is.
 *
 * Shared by all three OTP screens (customer sign-in, admin add-customer, and
 * the same wizard inline in new-transaction) so the wording and the rule behind
 * it stay identical. The rule: `devOtpCode` is present only when the API sent
 * nothing, so its presence is the mode switch. Never infer mock mode any other
 * way here, and never default the field.
 *
 * The mock toast is deliberately long-lived and marked as such -- someone is
 * about to type it into five boxes, and a four-second toast would be gone.
 */
export function announceOtpSent(devOtpCode: string | undefined): void {
  if (devOtpCode) {
    toast.info(`کد تأیید (حالت آزمایشی): ${devOtpCode}`, {
      description: "پیامکی ارسال نشده است؛ این کد فقط برای آزمایش نمایش داده می‌شود.",
      // Long enough to read and retype, and reusing one id so a resend replaces
      // the previous code rather than stacking a stale one beside it.
      duration: 60_000,
      id: "dev-otp",
    });
    return;
  }

  toast.success("کد تأیید ارسال شد", {
    description: "پیامک حاوی کد به شماره‌ی شما ارسال شد.",
  });
}
