const DAY_MS = 24 * 60 * 60 * 1000;

export const addDays = (d: Date, days: number) =>
  new Date(d.getTime() + days * DAY_MS);

/** Soma meses mantendo o dia quando possível (31/01 + 1 mês = 28 ou 29/02). */
export function addMonths(d: Date, months: number): Date {
  const r = new Date(d.getTime());
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0),
  ).getUTCDate();
  r.setUTCDate(Math.min(day, lastDay));
  return r;
}

/** Diferença em dias inteiros (b - a), truncada. */
export const daysBetween = (a: Date, b: Date) =>
  Math.floor((b.getTime() - a.getTime()) / DAY_MS);
