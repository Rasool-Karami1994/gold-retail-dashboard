const TIME_ZONE = "Asia/Tehran";

const DAY_MS = 86_400_000;
const STEP_FUDGE_MS = DAY_MS / 2;

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

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

export function shopDayKey(at: Date): string {
  return dayKeyFormat.format(at);
}

function zoneOffsetMs(at: Date): number {
  const name = offsetFormat
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")?.value;

  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name ?? "");
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  return sign * (hours * 60 + minutes) * 60_000;
}

export function shopDayStart(at: Date): Date {
  const utcMidnight = Date.parse(`${shopDayKey(at)}T00:00:00.000Z`);
  const firstGuess = utcMidnight - zoneOffsetMs(at);
  return new Date(utcMidnight - zoneOffsetMs(new Date(firstGuess)));
}

export function addShopDays(at: Date, n: number): Date {
  return shopDayStart(new Date(shopDayStart(at).getTime() + n * DAY_MS + STEP_FUDGE_MS));
}

function persianParts(at: Date): { year: number; month: number; day: number } {
  const parts = persianPartsFormat.formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return { year: read("year"), month: read("month"), day: read("day") };
}

function persianWeekdayIndex(at: Date): number {
  const order = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
  const label = weekdayFormat.format(at);
  const index = order.indexOf(label);
  return index === -1 ? 0 : index;
}

export function shopWeekStart(at: Date): Date {
  return addShopDays(at, -persianWeekdayIndex(at));
}

export function shopMonthStart(at: Date): Date {
  return addShopDays(at, -(persianParts(at).day - 1));
}

export type Granularity = "day" | "week" | "month";

export function nextBucketStart(start: Date, granularity: Granularity): Date {
  switch (granularity) {
    case "day":
      return addShopDays(start, 1);
    case "week":
      return addShopDays(start, 7);
    case "month": {
      return shopMonthStart(addShopDays(start, 32));
    }
  }
}

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

export function bucketStarts(
  from: Date,
  to: Date,
  granularity: Granularity,
): Date[] {
  const starts: Date[] = [];
  let cursor = bucketStartFor(from, granularity);

  while (cursor.getTime() <= to.getTime()) {
    starts.push(cursor);
    const next = nextBucketStart(cursor, granularity);
    if (next.getTime() <= cursor.getTime()) break;
    cursor = next;
  }

  return starts;
}
