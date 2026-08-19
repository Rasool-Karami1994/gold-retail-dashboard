import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

export const CALENDAR = persian;
export const LOCALE = persian_fa;

export type DateRangePreset = "today" | "week" | "month" | "year" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
  preset: DateRangePreset;
}

export function jalaliToday(): DateObject {
  return new DateObject({ calendar: CALENDAR, locale: LOCALE });
}

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

export function rangeFromPicker(from: DateObject, to: DateObject): DateRange {
  const [earlier, later] =
    from.toDate().getTime() <= to.toDate().getTime() ? [from, to] : [to, from];

  return {
    from: startOfDay(earlier).toDate(),
    to: endOfDay(later).toDate(),
    preset: "custom",
  };
}

export function toApiDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromApiDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function formatJalali(date: Date, format = "YYYY/MM/DD"): string {
  return new DateObject({
    date,
    calendar: CALENDAR,
    locale: LOCALE,
  }).format(format);
}

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
