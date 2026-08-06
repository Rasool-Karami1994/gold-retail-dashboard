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

/**
 * Staff "add customer" flow, as a component rather than a screen.
 *
 * Two callers: /admin/customers/new renders it in a card, and the new-transaction
 * form opens it in a modal when the mobile it looked up has no customer. It
 * therefore owns the flow and nothing around it -- no card, no page heading, no
 * navigation. What happens after a successful create is the caller's business,
 * which is why `onCreated` exists instead of a router.push in here.
 *
 * Three API calls, deliberately in this order:
 *
 *   1. request-otp (purpose 'register')  -- texts the customer a code
 *   2. verify-otp  (purpose 'register')  -- proves the number answers
 *   3. POST /api/admin/customers         -- creates the record
 *
 * The OTP is not decoration. Without step 2 an admin could type any number into
 * the system, and whoever actually owns that number would later be able to sign
 * in to an account they never asked for -- a customer's mobile IS their login
 * identity here. The API enforces the order: creating without a recent verified
 * 'register' receipt is a 403.
 *
 * Verifying a 'register' code establishes no customer session, so the admin's
 * own cookie survives the round trip.
 */

/** Mirrors OTP_LENGTH in apps/api/.env. */
const OTP_LENGTH = 5;

const STEPS = ["اطلاعات مشتری", "تأیید شماره"];

/**
 * Names are bounded at 60 to match the model's `maxlength`, so an over-long
 * name is caught before a round trip. The mobile rule is the client-side twin
 * of the API's -- see lib/mobile.ts on why it is duplicated.
 */
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

/* ---- Error messages ------------------------------------------------------ */

/**
 * Mapped on HTTP status, never on `error.message`: the API answers in English,
 * and its wording is a server concern that should not surface in a Persian UI.
 */
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
    // The API returns 400 both for a wrong code and for an expired one. The two
    // are not distinguishable by status, so the message covers both rather than
    // guessing -- and points at the remedy for either.
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
    // The verification receipt has a 15-minute life. Past it the number has to
    // be proved again, so this sends the user back to step 1 rather than
    // offering a retry that would fail identically.
    case 403:
      return "مهلت تأیید شماره به پایان رسیده است. لطفاً دوباره کد بگیرید.";
    case 409:
      return "مشتری‌ای با این شماره موبایل از قبل ثبت شده است.";
    default:
      return SERVER;
  }
}

/* ---- Wizard -------------------------------------------------------------- */

export interface NewCustomerWizardProps {
  /** Prefills the mobile, for when the caller already knows what was typed. */
  initialMobile?: string;
  /** The created customer. The caller decides where to go from here. */
  onCreated: (customer: CreatedCustomer) => void;
  /** Rendered beside the first step's submit -- a cancel link, a close button. */
  secondaryAction?: React.ReactNode;
}

export function NewCustomerWizard({
  initialMobile = "",
  onCreated,
  secondaryAction,
}: NewCustomerWizardProps) {
  const queryClient = useQueryClient();

  const [step, setStep] = React.useState(0);
  /** Filled from step 1, with the mobile as the API normalised it. */
  const [details, setDetails] = React.useState<DetailsValues | null>(null);
  const [code, setCode] = React.useState("");
  const [secondsLeft, setSecondsLeft] = React.useState(0);

  /**
   * THE REASON THIS IS A REF AND NOT DERIVED STATE.
   *
   * A verified code is spent: verify-otp looks for an *unverified* record, so
   * calling it a second time with the same code answers 400 "expired". If the
   * create call then fails for its own reasons -- a dropped connection, a
   * server blip -- retrying must NOT re-verify. This flag is what makes the
   * retry resume at step 3 instead of throwing away a perfectly good receipt.
   */
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

  /** Ticks the resend countdown down to zero. */
  React.useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const requestCode = useMutation({
    mutationFn: (values: DetailsValues) => requestRegisterOtp(values.mobile),
    onSuccess: (result, values) => {
      // Store the API's normalised form, not what was typed: every later call
      // has to name the same number the OTP record was filed under.
      setDetails({ ...values, mobile: result.mobile });
      setCode("");
      verified.current = false;
      setFailedPhase(null);
      // Also clears any complaint about the PREVIOUS code. This runs on resend
      // as well as on the first request, and "the code is wrong" left standing
      // over a freshly sent one reads as a failure that just happened.
      confirm.reset();
      setSecondsLeft(result.expiresInSeconds);
      setStep(1);
      // Shows the code itself when the API is mocking SMS. This wizard is used
      // both on /admin/customers/new and inline in the new-transaction form, so
      // both get it from here.
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
      // Which half failed is not in the error, but the flag above says whether
      // verification had already gone through when it was thrown.
      setFailedPhase(verified.current ? "create" : "verify");
    },
    onSuccess: (customer) => {
      // Every cached page and search of the list is now stale by one row.
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      onCreated(customer);
    },
  });

  /** Sends a fresh code for the same number, e.g. after the first one expired. */
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

  /**
   * Stays busy through `isSuccess`: whatever the caller does next has not
   * painted yet, and a button that springs back to clickable invites a second
   * submit against a spent code.
   */
  const confirming = confirm.isPending || confirm.isSuccess;

  const requestError = requestCode.error ? messageForRequest(requestCode.error) : null;
  const confirmError = confirm.error
    ? failedPhase === "create"
      ? messageForCreate(confirm.error)
      : messageForVerify(confirm.error)
    : null;

  /** A spent registration window cannot be retried; only a new code fixes it. */
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
              // Clear the previous complaint as soon as the code changes; it
              // referred to what was there before.
              if (confirm.error) confirm.reset();
            }}
            length={OTP_LENGTH}
            autoFocus
            // Once the number is proved, the code is history -- a create
            // failure must not paint the OTP boxes red.
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

          {/* A verified number with a failed create is a different situation
              from a wrong code: the customer does not need to read anything
              back, the write just has to be tried again. */}
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
