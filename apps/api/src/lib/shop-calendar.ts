/**
 * Calendar arithmetic on the SHOP's clock and calendar.
 *
 * Two things here that the rest of the API takes for granted:
 *
 *   1. A "day" is a Tehran day, not a UTC one. The shop closes at night local
 *      time, so a sale rung up at 21:00 in Tehran belongs to that day and not
 *      to the next one, which is what UTC would say (+03:30).
 *   2. A "month" is a JALALI month, and a "week" starts on Saturday. Bucketing
 *      a capital series by Gregorian months would draw boundaries partway
 *      through every month the shop actually keeps books by.
 *
 * All of it runs on the platform's ICU -- Node ships full ICU, so the Persian
 * calendar (leap years included) is already there. `models/transaction.model.ts`
 * does the same thing inline for invoice numbers; this module is the general
 * version, kept separate because the capital series needs boundaries, not just
 * a stamp.
 *
 * Everything returns plain `Date` instants, so callers never touch a calendar.
 */

const TIME_ZONE = "Asia/Tehran";

const DAY_MS = 86_400_000;
/**
 * Half a day, added before re-normalising when stepping by whole days. A day
 * step lands at local midnight ± any offset change; the fudge keeps it inside
 * the intended day for any shift smaller than 12 hours, which is every real
 * one. Iran has had no DST since 2022, but records predate that.
 */
const STEP_FUDGE_MS = DAY_MS / 2;

/** `YYYY-MM-DD` for the Tehran day containing `at`. en-CA renders exactly that. */
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Persian calendar parts, in ASCII digits so they can be parsed back. */
const persianPartsFormat = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

const weekdayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  weekday: "short",
});

const offsetFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  timeZoneName: "longOffset",
});

/** The Gregorian Tehran day containing `at`, as `YYYY-MM-DD`. */
export function shopDayKey(at: Date): string {
  return dayKeyFormat.format(at);
}

/** Tehran's UTC offset in milliseconds at a given instant. */
function zoneOffsetMs(at: Date): number {
  const name = offsetFormat
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")?.value;

  // "GMT+03:30", or bare "GMT" at a zero offset.
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name ?? "");
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  return sign * (hours * 60 + minutes) * 60_000;
}

/**
 * Midnight in Tehran that BEGINS the Tehran day containing `at`.
 *
 * The offset is applied twice on purpose. The first pass uses the offset at
 * `at`, which is the wrong one when `at` sits on the far side of a transition
 * from the midnight being computed; the second pass re-reads it at the instant
 * the first produced, which lands on the right side. One correction is enough
 * for any offset change smaller than the distance between the two instants.
 */
export function shopDayStart(at: Date): Date {
  const utcMidnight = Date.parse(`${shopDayKey(at)}T00:00:00.000Z`);
  const firstGuess = utcMidnight - zoneOffsetMs(at);
  return new Date(utcMidnight - zoneOffsetMs(new Date(firstGuess)));
}

/** `n` Tehran days after the day containing `at`, at local midnight. */
export function addShopDays(at: Date, n: number): Date {
  return shopDayStart(new Date(shopDayStart(at).getTime() + n * DAY_MS + STEP_FUDGE_MS));
}

function persianParts(at: Date): { year: number; month: number; day: number } {
  const parts = persianPartsFormat.formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return { year: read("year"), month: read("month"), day: read("day") };
}

/** 0 = Saturday … 6 = Friday, which is how the Persian week is numbered. */
function persianWeekdayIndex(at: Date): number {
  const order = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
  const label = weekdayFormat.format(at);
  const index = order.indexOf(label);
  return index === -1 ? 0 : index;
}

/** Local midnight on the Saturday that opens `at`'s Persian week. */
export function shopWeekStart(at: Date): Date {
  return addShopDays(at, -persianWeekdayIndex(at));
}

/** Local midnight on the first day of `at`'s Jalali month. */
export function shopMonthStart(at: Date): Date {
  // The Persian day-of-month is 1-based, so backing off `day - 1` days lands on
  // the first -- no month-length table needed, and leap years take care of
  // themselves because ICU did the conversion.
  return addShopDays(at, -(persianParts(at).day - 1));
}

export type Granularity = "day" | "week" | "month";

/** The next bucket start after `start`, for the given granularity. */
export function nextBucketStart(start: Date, granularity: Granularity): Date {
  switch (granularity) {
    case "day":
      return addShopDays(start, 1);
    case "week":
      return addShopDays(start, 7);
    case "month": {
      // Step into the following month by landing somewhere inside it -- Jalali
      // months are 29, 30 or 31 days, so a fixed step would drift. Day 32 from
      // the first is always in the next month; normalising then snaps back to
      // its first day.
      return shopMonthStart(addShopDays(start, 32));
    }
  }
}

/** The bucket start that contains `at`. */
export function bucketStartFor(at: Date, granularity: Granularity): Date {
  switch (granularity) {
    case "day":
      return shopDayStart(at);
    case "week":
      return shopWeekStart(at);
    case "month":
      return shopMonthStart(at);
  }
}

/**
 * Every bucket start from `from` to `to` inclusive, on the shop's calendar.
 *
 * The first entry is the start of the bucket CONTAINING `from`, not `from`
 * itself: a range beginning mid-month still belongs to that month, and a series
 * whose first bar covered three days while the rest covered thirty would be
 * unreadable. Callers that must not report before a certain instant clamp the
 * values, not the buckets.
 */
export function bucketStarts(
  from: Date,
  to: Date,
  granularity: Granularity,
): Date[] {
  const starts: Date[] = [];
  let cursor = bucketStartFor(from, granularity);

  // Bounded by the caller's range; the coarsening in the capital service keeps
  // that from being unbounded in practice.
  while (cursor.getTime() <= to.getTime()) {
    starts.push(cursor);
    const next = nextBucketStart(cursor, granularity);
    // Defensive: a calendar step that failed to advance would spin forever.
    if (next.getTime() <= cursor.getTime()) break;
    cursor = next;
  }

  return starts;
}
