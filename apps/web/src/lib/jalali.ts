import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

/**
 * Jalali (Persian calendar) date helpers.
 *
 * Range presets are computed **on the Persian calendar**, not the Gregorian
 * one. This matters: "this month" for an Iranian shop means the current Jalali
 * month, which starts partway through a Gregorian one, and "this week" starts
 * on Saturday rather than Sunday or Monday. Reaching for `startOfMonth()` from
 * a Gregorian date library here would produce ranges that look plausible and
 * are consistently wrong.
 *
 * Boundaries come back as plain JS `Date`s, so they can go straight into an API
 * query without the caller knowing about calendars at all.
 */

export const CALENDAR = persian;
export const LOCALE = persian_fa;

export type DateRangePreset = "today" | "week" | "month" | "year" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
  preset: DateRangePreset;
}

/** Today, on the Persian calendar. */
export function jalaliToday(): DateObject {
  return new DateObject({ calendar: CALENDAR, locale: LOCALE });
}

/** Clones -- DateObject's `toFirstOf*` / `add` methods mutate in place. */
function clone(date: DateObject): DateObject {
  return new DateObject(date);
}

function startOfDay(date: DateObject): DateObject {
  return clone(date).set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
}

function endOfDay(date: DateObject): DateObject {
  return clone(date).set({
    hour: 23,
    minute: 59,
    second: 59,
    millisecond: 999,
  });
}

/**
 * Inclusive [from, to] for a preset, anchored on `reference` (default today).
 *
 * `custom` has no computed range -- the caller supplies one from the picker --
 * so it falls back to today rather than throwing.
 */
export function rangeForPreset(
  preset: Exclude<DateRangePreset, "custom">,
  reference: DateObject = jalaliToday(),
): DateRange {
  switch (preset) {
    case "today":
      return {
        from: startOfDay(reference).toDate(),
        to: endOfDay(reference).toDate(),
        preset,
      };

    case "week":
      return {
        // Persian week runs Saturday..Friday; the locale defines that, and
        // toFirstOfWeek honours it.
        from: startOfDay(clone(reference).toFirstOfWeek()).toDate(),
        to: endOfDay(clone(reference).toLastOfWeek()).toDate(),
        preset,
      };

    case "month":
      return {
        from: startOfDay(clone(reference).toFirstOfMonth()).toDate(),
        to: endOfDay(clone(reference).toLastOfMonth()).toDate(),
        preset,
      };

    case "year":
      return {
        from: startOfDay(clone(reference).toFirstOfYear()).toDate(),
        to: endOfDay(clone(reference).toLastOfYear()).toDate(),
        preset,
      };
  }
}

/** Builds a range from two picker selections, normalising the day boundaries. */
export function rangeFromPicker(from: DateObject, to: DateObject): DateRange {
  // The picker can hand back the endpoints in either order if the user clicks
  // the later day first.
  const [earlier, later] =
    from.toDate().getTime() <= to.toDate().getTime() ? [from, to] : [to, from];

  return {
    from: startOfDay(earlier).toDate(),
    to: endOfDay(later).toDate(),
    preset: "custom",
  };
}

/** e.g. ۱۴۰۵/۰۵/۱۰ */
export function formatJalali(date: Date, format = "YYYY/MM/DD"): string {
  return new DateObject({
    date,
    calendar: CALENDAR,
    locale: LOCALE,
  }).format(format);
}

/** e.g. ۱۴۰۵/۰۵/۰۱ – ۱۴۰۵/۰۵/۳۱, collapsed to one date when they match. */
export function formatJalaliRange(from: Date, to: Date): string {
  const start = formatJalali(from);
  const end = formatJalali(to);
  return start === end ? start : `${start} – ${end}`;
}

export const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "امروز",
  week: "این هفته",
  month: "این ماه",
  year: "امسال",
  custom: "بازه دلخواه",
};
