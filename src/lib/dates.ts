/** Local calendar date as YYYY-MM-DD (not UTC, so "today" matches the user's wall clock). */
export function localDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Monday-start week containing `d`. */
export function weekStart(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7;
  return addDays(x, -dow);
}

export function formatDay(s: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return parseLocalDate(s).toLocaleDateString(undefined, opts);
}

export function daysSince(s: string | undefined, now = new Date()) {
  if (!s) return Infinity;
  return Math.floor((parseLocalDate(localDate(now)).getTime() - parseLocalDate(s.slice(0, 10)).getTime()) / 86_400_000);
}
