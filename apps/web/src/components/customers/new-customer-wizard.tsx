"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button, Input, OtpInput } from "@/components/ui";
import { ApiError } from "@/lib/api";
import {
  createCustomer,
  customerKeys,
  requestRegisterOtp,
  verifyRegisterOtp,
  type CreatedCustomer,
} from "@/lib/customers-api";
import { formatNumber } from "@/lib/format";
import { isValidMobile, normalizeMobile } from "@/lib/mobile";
import { announceOtpSent } from "@/lib/otp-toast";
import { Stepper } from "./stepper";

const OTP_LENGTH = 5;

const STEPS = ["اطلاعات مشتری", "تأیید شماره"];

const detailsSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "نام را وارد کنید")
    .max(60, "نام حداکثر ۶۰ نویسه است"),
  lastName: z
    .string()
    .trim()
    .min(1, "نام خانوادگی را وارد کنید")
    .max(60, "نام خانوادگی حداکثر ۶۰ نویسه است"),
  mobile: z
    .string()
    .trim()
    .min(1, "شماره موبایل را وارد کنید")
    .refine(isValidMobile, "شماره موبایل معتبر نیست. نمونه: ۰۹۱۲۳۴۵۶۷۸۹"),
});

type DetailsValues = z.infer<typeof detailsSchema>;

const OFFLINE = "اتصال به سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.";
const SESSION_LOST = "نشست شما منقضی شده است. دوباره وارد شوید.";
const SERVER = "خطای سرور. لطفاً بعداً دوباره تلاش کنید.";

function statusOf(error: unknown): number | null {
  return error instanceof ApiError ? error.status : null;
}

function messageForRequest(error: unknown): string {
  switch (statusOf(error)) {
    case null:
      return OFFLINE;
    case 400:
      return "شماره موبایل معتبر نیست.";
    case 401:
    case 403:
      return SESSION_LOST;
    case 409:
      return "مشتری‌ای با این شماره موبایل از قبل ثبت شده است.";
    case 429:
      return "درخواست‌های بیش از حد مجاز. کمی بعد دوباره تلاش کنید.";
    case 502:
      return "ارسال پیامک انجام نشد. لطفاً دوباره تلاش کنید.";
    default:
      return SERVER;
  }
}

function messageForVerify(error: unknown): string {
  switch (statusOf(error)) {
    case null:
      return OFFLINE;
    case 400:
      return "کد وارد شده نادرست یا منقضی شده است. دوباره تلاش کنید یا کد جدید بگیرید.";
    case 401:
    case 403:
      return SESSION_LOST;
    case 429:
      return "تلاش‌های نادرست بیش از حد مجاز. کد جدیدی درخواست کنید.";
    default:
      return SERVER;
  }
}

function messageForCreate(error: unknown): string {
  switch (statusOf(error)) {
    case null:
      return OFFLINE;
    case 400:
      return "اطلاعات وارد شده معتبر نیست.";
    case 401:
      return SESSION_LOST;
    case 403:
      return "مهلت تأیید شماره به پایان رسیده است. لطفاً دوباره کد بگیرید.";
    case 409:
      return "مشتری‌ای با این شماره موبایل از قبل ثبت شده است.";
    default:
      return SERVER;
  }
}

export interface NewCustomerWizardProps {
  initialMobile?: string;
  onCreated: (customer: CreatedCustomer) => void;
  secondaryAction?: React.ReactNode;
}

export function NewCustomerWizard({
  initialMobile = "",
  onCreated,
  secondaryAction,
}: NewCustomerWizardProps) {
  const queryClient = useQueryClient();

  const [step, setStep] = React.useState(0);
  const [details, setDetails] = React.useState<DetailsValues | null>(null);
  const [code, setCode] = React.useState("");
  const [secondsLeft, setSecondsLeft] = React.useState(0);

  const verified = React.useRef(false);
  const [failedPhase, setFailedPhase] = React.useState<"verify" | "create" | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { firstName: "", lastName: "", mobile: initialMobile },
  });

  React.useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const requestCode = useMutation({
    mutationFn: (values: DetailsValues) => requestRegisterOtp(values.mobile),
    onSuccess: (result, values) => {
      setDetails({ ...values, mobile: result.mobile });
      setCode("");
      verified.current = false;
      setFailedPhase(null);
      confirm.reset();
      setSecondsLeft(result.expiresInSeconds);
      setStep(1);
      announceOtpSent(result.devOtpCode);
    },
  });

  const confirm = useMutation({
    mutationFn: async () => {
      if (!details) throw new Error("missing details");

      if (!verified.current) {
        await verifyRegisterOtp({ mobile: details.mobile, code });
        verified.current = true;
      }

      return createCustomer(details);
    },
    onError: () => {
      setFailedPhase(verified.current ? "create" : "verify");
    },
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      onCreated(customer);
    },
  });

  const resend = () => {
    const values = details ?? getValues();
    requestCode.mutate({ ...values, mobile: normalizeMobile(values.mobile) });
  };

  const backToDetails = () => {
    setStep(0);
    setCode("");
    verified.current = false;
    setFailedPhase(null);
    requestCode.reset();
    confirm.reset();
  };

  const confirming = confirm.isPending || confirm.isSuccess;

  const requestError = requestCode.error ? messageForRequest(requestCode.error) : null;
  const confirmError = confirm.error
    ? failedPhase === "create"
      ? messageForCreate(confirm.error)
      : messageForVerify(confirm.error)
    : null;

  const windowExpired =
    failedPhase === "create" && statusOf(confirm.error) === 403;

  return (
    <div className="flex flex-col gap-8">
      <Stepper steps={STEPS} current={step} />

      {step === 0 ? (
        <form
          noValidate
          onSubmit={handleSubmit((values) => requestCode.mutate(values))}
          className="flex flex-col gap-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="نام"
              autoComplete="given-name"
              autoFocus
              error={errors.firstName?.message}
              {...register("firstName")}
            />
            <Input
              label="نام خانوادگی"
              autoComplete="family-name"
              error={errors.lastName?.message}
              {...register("lastName")}
            />
          </div>

          <Input
            label="شماره موبایل"
            inputMode="numeric"
            autoComplete="tel"
            dir="ltr"
            placeholder="09123456789"
            hint="کد تأیید به همین شماره پیامک می‌شود و بعداً قابل تغییر نیست."
            error={errors.mobile?.message}
            {...register("mobile")}
          />

          {requestError && <FormError>{requestError}</FormError>}

          <div className="flex items-center gap-3">
            <Button type="submit" loading={requestCode.isPending}>
              ارسال کد تأیید
            </Button>
            {secondaryAction}
          </div>
        </form>
      ) : (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            confirm.mutate();
          }}
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-1">
            <p className="text-sm text-fg-secondary">
              کد {formatNumber(OTP_LENGTH)} رقمی ارسال‌شده به شماره‌ی زیر را وارد کنید.
            </p>
            <p className="flex items-center gap-2 text-sm">
              <span className="font-mono text-fg" dir="ltr">
                {details?.mobile}
              </span>
              <button
                type="button"
                onClick={backToDetails}
                className="text-xs text-link hover:underline"
              >
                ویرایش
              </button>
            </p>
          </div>

          <OtpInput
            value={code}
            onChange={(next) => {
              setCode(next);
              if (confirm.error) confirm.reset();
            }}
            length={OTP_LENGTH}
            autoFocus
            invalid={Boolean(confirm.error) && failedPhase === "verify"}
            disabled={confirming || verified.current}
          />

          <div className="flex items-center gap-3 text-xs">
            {secondsLeft > 0 ? (
              <span className="text-fg-muted">
                ارسال مجدد کد تا {formatNumber(secondsLeft)} ثانیه دیگر
              </span>
            ) : (
              <button
                type="button"
                onClick={resend}
                disabled={requestCode.isPending}
                className="text-link hover:underline disabled:opacity-50"
              >
                {requestCode.isPending ? "در حال ارسال…" : "ارسال مجدد کد"}
              </button>
            )}
          </div>

          {confirmError && <FormError>{confirmError}</FormError>}
          {requestError && <FormError>{requestError}</FormError>}

          {failedPhase === "create" && !windowExpired && (
            <p className="text-xs text-fg-muted">
              شماره تأیید شد؛ فقط ثبت اطلاعات ناتمام ماند.
            </p>
          )}

          <div className="flex items-center gap-3">
            {windowExpired ? (
              <Button type="button" onClick={backToDetails}>
                شروع دوباره
              </Button>
            ) : (
              <Button
                type="submit"
                loading={confirming}
                disabled={code.length < OTP_LENGTH && !verified.current}
              >
                {failedPhase === "create" ? "تلاش دوباره" : "تأیید و ثبت مشتری"}
              </Button>
            )}

            <Button type="button" variant="ghost" onClick={backToDetails}>
              بازگشت
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      aria-live="polite"
      className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
    >
      {children}
    </p>
  );
}
