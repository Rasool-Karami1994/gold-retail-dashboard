"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, CardContent, CurrencyInput, toast } from "@/components/ui";
import { ApiError } from "@/lib/api";
import {
  capitalKeys,
  fetchGoldPrice,
  recordGoldPrice,
  type GoldPriceContext,
} from "@/lib/capital-api";
import { formatJalali } from "@/lib/jalali";
import { formatToman } from "@/lib/format";
import { toNumber } from "@/lib/numbers";

/**
 * Today's gold price, at the top of the capital screen because everything
 * below it is valued at this number.
 *
 * The action changes wording with the day's state: a day with no price on
 * record is "ثبت", a day that already has one is "به‌روزرسانی", because the
 * endpoint upserts by day -- submitting again corrects today's figure rather
 * than adding a second one, and the button should say so before it is pressed.
 */
export function GoldPriceForm() {
  const queryClient = useQueryClient();
  const [price, setPrice] = React.useState("");
  /**
   * Whether the field has been touched since the query answered. Without it,
   * the prefill effect below would overwrite what someone is typing the moment
   * a refetch resolves -- and this query is invalidated by its own submit.
   */
  const touched = React.useRef(false);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: capitalKeys.price(),
    queryFn: fetchGoldPrice,
  });

  const todaysPrice = data?.today?.pricePerGram;

  React.useEffect(() => {
    if (todaysPrice === undefined || touched.current) return;
    setPrice(String(todaysPrice));
  }, [todaysPrice]);

  const mutation = useMutation({
    mutationFn: (value: number) => recordGoldPrice(value),
    onSuccess: (saved) => {
      touched.current = false;
      queryClient.setQueryData<GoldPriceContext>(capitalKeys.price(), {
        today: saved,
        latest: saved,
      });
      // Every figure on the screen is priced off this number.
      queryClient.invalidateQueries({ queryKey: capitalKeys.all });

      toast.success(
        todaysPrice === undefined
          ? "قیمت امروز ثبت شد."
          : "قیمت امروز به‌روزرسانی شد.",
        { description: `${formatToman(saved.pricePerGram)} تومان بر گرم` },
      );
    },
    onError: (error) => {
      const status = error instanceof ApiError ? error.status : 0;
      toast.error(
        status === 400
          ? "قیمت واردشده معتبر نیست."
          : status === 401 || status === 403
            ? "دسترسی شما منقضی شده است. دوباره وارد شوید."
            : "ثبت قیمت انجام نشد. دوباره تلاش کنید.",
      );
    },
  });

  const value = toNumber(price);
  const valid = Number.isFinite(value) && value > 0;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    mutation.mutate(value);
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-bold text-fg">قیمت روز طلا</h2>
          <p className="text-xs text-fg-muted">
            {isPending ? (
              <span className="inline-block h-3 w-64 animate-pulse rounded bg-surface-raised align-middle" />
            ) : isError ? (
              "قیمت ثبت‌شده خوانده نشد؛ می‌توانید قیمت امروز را دوباره ثبت کنید."
            ) : (
              <PriceStatus data={data} />
            )}
          </p>
        </div>

        <form
          onSubmit={submit}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="sm:max-w-xs sm:flex-1">
            <CurrencyInput
              label="قیمت هر گرم (تومان)"
              value={price}
              onChange={(next) => {
                touched.current = true;
                setPrice(next);
              }}
              placeholder="۵٬۰۰۰٬۰۰۰"
              disabled={isPending}
            />
          </div>

          <Button
            type="submit"
            loading={mutation.isPending}
            disabled={!valid || isPending}
            className="sm:mb-6"
          >
            {todaysPrice === undefined ? "ثبت قیمت امروز" : "به‌روزرسانی قیمت"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * What the figures are currently priced at, and whether that price is today's.
 *
 * A carried-forward price is not an error, but it is the difference between a
 * measured number and an estimate -- the same distinction the chart draws on
 * its points -- so the screen says it in words as well.
 */
function PriceStatus({ data }: { data: GoldPriceContext | undefined }) {
  if (data?.today) {
    return (
      <>
        قیمت امروز ثبت شده است:{" "}
        <span className="font-medium text-fg-secondary">
          {formatToman(data.today.pricePerGram)} تومان
        </span>
        . ثبت دوباره، همین رقم را اصلاح می‌کند.
      </>
    );
  }

  if (data?.latest) {
    return (
      <>
        برای امروز قیمتی ثبت نشده؛ محاسبه‌ها فعلاً با آخرین قیمت ثبت‌شده در{" "}
        <span className="font-medium text-fg-secondary">
          {formatJalali(new Date(data.latest.date))}
        </span>{" "}
        ({formatToman(data.latest.pricePerGram)} تومان) انجام می‌شود.
      </>
    );
  }

  return <>هنوز هیچ قیمتی ثبت نشده است. تا ثبت اولین قیمت، سرمایه محاسبه نمی‌شود.</>;
}
