/**
 * Shared handling for `from`/`to` style filters, so every endpoint that takes
 * a date range agrees on what the bounds mean.
 */

/**
 * Widens a date-only bound to the end of that day.
 *
 * A date picker sends `2026-08-02`, which parses to midnight. Filtering `$lte`
 * on that would silently exclude everything that happened on the day the user
 * asked for -- the most common off-by-one in a range filter. A caller who
 * wants a precise instant sends a full timestamp and gets it used verbatim.
 */
export function inclusiveEnd(date: Date): Date {
  const isMidnightUtc =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0;

  return isMidnightUtc ? new Date(date.getTime() + 86_400_000 - 1) : date;
}

/**
 * Builds a Mongo range clause, or `undefined` when neither bound was given so
 * the caller can leave the field out of the query entirely.
 */
export function dateRangeClause(
  from?: Date,
  to?: Date,
): { $gte?: Date; $lte?: Date } | undefined {
  if (!from && !to) return undefined;

  return {
    ...(from ? { $gte: from } : {}),
    ...(to ? { $lte: inclusiveEnd(to) } : {}),
  };
}
