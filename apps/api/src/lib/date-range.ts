export function inclusiveEnd(date: Date): Date {
  const isMidnightUtc =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0;

  return isMidnightUtc ? new Date(date.getTime() + 86_400_000 - 1) : date;
}

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
