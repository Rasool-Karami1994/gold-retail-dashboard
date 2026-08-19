import { toast } from "@/components/ui";

export function announceOtpSent(devOtpCode: string | undefined): void {
  if (devOtpCode) {
    toast.info(`کد تأیید (حالت آزمایشی): ${devOtpCode}`, {
      description: "پیامکی ارسال نشده است؛ این کد فقط برای آزمایش نمایش داده می‌شود.",
      duration: 60_000,
      id: "dev-otp",
    });
    return;
  }

  toast.success("کد تأیید ارسال شد", {
    description: "پیامک حاوی کد به شماره‌ی شما ارسال شد.",
  });
}
