/**
 * The year of birth (journey §6.2 ch. 2, K-43, B-31). A number field, checked
 * to be 1920 to this year minus 18. A year alone can't say whether the
 * birthday has passed, so the one borderline year asks "Are you 18 or over?",
 * and age-limited features read any year at the lower end of its range.
 */
export const OLDEST_YEAR = 1920;
export const ADULT_AGE = 18;

/** What's wrong with the year, or `null`. Empty is fine: the question is optional. */
export function birthYearProblem(year: number | undefined, thisYear: number): string | null {
  if (year === undefined) return null;
  if (!Number.isInteger(year)) return 'Enter the year as four digits, such as 1958.';
  if (year < OLDEST_YEAR || year > thisYear) return `Enter the year you were born, from ${OLDEST_YEAR}.`;
  if (year > thisYear - ADULT_AGE) return 'FitStrong is made for adults aged 18 and over.';
  return null;
}

/** B-31: only this year minus 18 could be 17 or 18. */
export function asksAdult(year: number | undefined, thisYear: number): boolean {
  return year === thisYear - ADULT_AGE;
}

/** The age a year allows: the birthday this year may or may not have passed. "18 or over" lifts the lower end. */
export function ageRange(year: number | undefined, today: Date, adult?: boolean): { min: number; max: number } | undefined {
  if (year === undefined) return undefined;
  const max = today.getFullYear() - year;
  return { min: adult === true && max === ADULT_AGE ? ADULT_AGE : max - 1, max };
}
