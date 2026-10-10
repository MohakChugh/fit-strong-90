/** "3 Oct 2026", in the phone's own date style. */
export function shortDate(value: string): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return 'on a date that cannot be read';
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ms));
}

/** "3 Oct 2026" for a `YYYY-MM-DD` day, read as that local day rather than UTC midnight. */
export function shortDay(day: string): string {
  return shortDate(`${day}T12:00:00`);
}
