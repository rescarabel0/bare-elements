/**
 * Calendar-date helpers on ISO `YYYY-MM-DD` strings.
 *
 * A calendar date has no time and no time zone, so all arithmetic runs in UTC: local `Date`
 * math shifts days around DST changes and in negative-offset time zones.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export interface DateParts {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
}

export function isValidParts({ year, month, day }: DateParts): boolean {
  if (!Number.isInteger(year) || year < 1 || year > 9999) return false;
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  return Number.isInteger(day) && day >= 1 && day <= daysInMonth(year, month);
}

/** Parses `YYYY-MM-DD`, rejecting impossible dates like `2026-02-30`. */
export function parseISODate(value: string | null | undefined): DateParts | null {
  const match = value ? ISO_DATE.exec(value) : null;
  if (!match) return null;
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return isValidParts(parts) ? parts : null;
}

export function isISODate(value: string | null | undefined): value is string {
  return parseISODate(value) !== null;
}

export function toISODate({ year, month, day }: DateParts): string {
  const pad = (n: number, width: number) => String(n).padStart(width, '0');
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** A UTC `Date` at midnight of the given ISO date, for `Intl` formatting with `timeZone: 'UTC'`. */
export function toUTCDate(iso: string): Date {
  const { year, month, day } = mustParse(iso);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCFullYear(year); // Date.UTC maps years 0-99 to 1900-1999
  return date;
}

function fromUTCDate(date: Date): string {
  return toISODate({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

export function addDays(iso: string, days: number): string {
  return fromUTCDate(new Date(toUTCDate(iso).getTime() + days * DAY_MS));
}

/** Adds months, clamping the day: Jan 31 + 1 month is Feb 28 (or 29). */
export function addMonths(iso: string, months: number): string {
  const { year, month, day } = mustParse(iso);
  const index = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return toISODate({
    year: nextYear,
    month: nextMonth,
    day: Math.min(day, daysInMonth(nextYear, nextMonth)),
  });
}

/** Day of the week, 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(iso: string): number {
  return toUTCDate(iso).getUTCDay();
}

/** The first day of the week containing `iso`, for weeks starting on `firstDay` (0 = Sunday). */
export function startOfWeek(iso: string, firstDay: number): string {
  return addDays(iso, -((dayOfWeek(iso) - firstDay + 7) % 7));
}

export function startOfMonth(iso: string): string {
  return toISODate({ ...mustParse(iso), day: 1 });
}

export function endOfMonth(iso: string): string {
  const { year, month } = mustParse(iso);
  return toISODate({ year, month, day: daysInMonth(year, month) });
}

/** Same year and month. */
export function isSameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** ISO dates with 4-digit years sort lexicographically. */
export function clampDate(iso: string, min?: string | null, max?: string | null): string {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

/** Today in the user's local time zone. */
export function todayISODate(): string {
  const now = new Date();
  return toISODate({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
}

/** First day of the week for a locale, 0 = Sunday. Falls back to Sunday where unsupported. */
export function firstDayOfWeek(locale: string): number {
  try {
    const info = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const firstDay = (info.getWeekInfo?.() ?? info.weekInfo)?.firstDay;
    // Intl uses 1 = Monday … 7 = Sunday.
    return firstDay === undefined ? 0 : firstDay % 7;
  } catch {
    return 0;
  }
}

/**
 * Numeric short date formatting and parsing for a locale, e.g. `10/11/2026` in pt-BR and
 * `11/10/2026` in en-US. Uses the locale's own field order so typed dates round-trip.
 */
const FIELD_LENGTH = { day: 2, month: 2, year: 4 } as const;
const DIGITS_PER_DATE = 8;

/** Between the two dates of a range in a text field: `02/11/2026 – 05/11/2026`. */
export const RANGE_SEPARATOR = ' – ';

export class NumericDateFormat {
  readonly #format: Intl.DateTimeFormat;
  /** Field order, e.g. `['day', 'month', 'year']`. */
  readonly order: ('day' | 'month' | 'year')[];

  constructor(locale: string) {
    this.#format = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    });
    this.order = this.#format
      .formatToParts(new Date(Date.UTC(2026, 0, 31)))
      .map((part) => part.type)
      .filter((type): type is 'day' | 'month' | 'year' => ['day', 'month', 'year'].includes(type));
  }

  format(iso: string): string {
    return this.#format.format(toUTCDate(iso));
  }

  /** What goes between consecutive fields, e.g. `['/', '/']` or `['.', '.']`. */
  get separators(): string[] {
    const separators: string[] = [];
    let seenField = false;
    let pending = '';
    for (const part of this.#format.formatToParts(new Date(Date.UTC(2026, 0, 31)))) {
      if (part.type === 'day' || part.type === 'month' || part.type === 'year') {
        if (seenField) separators.push(pending || '/');
        seenField = true;
        pending = '';
      } else if (seenField) {
        pending += part.value;
      }
    }
    return separators;
  }

  /** The fields of `count` consecutive dates, e.g. day, month, year, day, month, year. */
  fields(count = 1): ('day' | 'month' | 'year')[] {
    return Array.from({ length: count }, () => this.order).flat();
  }

  /**
   * Lays out digits in the locale's fields, e.g. `1011202` -> `10/11/202`. With `count: 2`, a
   * range: `1011202615` -> `10/11/2026 – 15`. With `trailing`, a separator follows a
   * just-completed field so the next digit lands after it.
   */
  mask(digits: string, trailing = false, count = 1): string {
    const separators = this.separators;
    const fields = this.fields(count);
    const perDate = this.order.length;
    let out = '';
    let rest = digits.replace(/\D/g, '');
    for (const [i, field] of fields.entries()) {
      const length = FIELD_LENGTH[field];
      const chunk = rest.slice(0, length);
      rest = rest.slice(length);
      out += chunk;
      if (chunk.length < length || i === fields.length - 1) break;
      if (rest.length > 0 || trailing) {
        out += (i + 1) % perDate === 0 ? RANGE_SEPARATOR : (separators[i % perDate] ?? '');
      }
    }
    return out;
  }

  /** A hint like `DD/MM/YYYY – DD/MM/YYYY`. */
  get rangePattern(): string {
    return `${this.pattern}${RANGE_SEPARATOR}${this.pattern}`;
  }

  /** A hint like `DD/MM/YYYY`, built from the locale's real separators. */
  get pattern(): string {
    const letters = { day: 'DD', month: 'MM', year: 'YYYY' } as const;
    return this.#format
      .formatToParts(new Date(Date.UTC(2026, 0, 31)))
      .map((part) =>
        part.type === 'day' || part.type === 'month' || part.type === 'year'
          ? letters[part.type]
          : part.value,
      )
      .join('');
  }

  /**
   * Parses typed text in the locale's field order. Any non-digit separates fields and two-digit
   * years mean 20xx. Returns `null` for anything that isn't a real date.
   */
  parse(text: string): string | null {
    const groups = text.trim().match(/\d+/g);
    return groups && groups.length === 3 ? this.#fromGroups(groups) : null;
  }

  /** Parses a typed range (`02/11/2026 – 05/11/2026`) into ISO dates, ends in any order. */
  parseRange(text: string): [string, string] | null {
    const groups = text.trim().match(/\d+/g);
    if (!groups || groups.length !== 6) return null;
    const a = this.#fromGroups(groups.slice(0, 3));
    const b = this.#fromGroups(groups.slice(3));
    if (!a || !b) return null;
    return a <= b ? [a, b] : [b, a];
  }

  formatRange(start: string, end: string): string {
    return `${this.format(start)}${RANGE_SEPARATOR}${this.format(end)}`;
  }

  #fromGroups(groups: string[]): string | null {
    const parts: Partial<DateParts> = {};
    this.order.forEach((field, i) => {
      const raw = groups[i] ?? '';
      let n = Number(raw);
      if (field === 'year' && raw.length <= 2) n += 2000;
      parts[field] = n;
    });
    const candidate = parts as DateParts;
    return isValidParts(candidate) ? toISODate(candidate) : null;
  }
}

function mustParse(iso: string): DateParts {
  const parts = parseISODate(iso);
  if (!parts) throw new RangeError(`Invalid ISO date: ${iso}`);
  return parts;
}

export interface MaskedInput {
  value: string;
  /** Where the caret goes in `value`. */
  caret: number;
}

const countDigits = (text: string) => text.replace(/\D/g, '').length;

const ISO_INTERVAL = /^(\d{4}-\d{2}-\d{2})\s*(?:\/|–|—|\.\.)\s*(\d{4}-\d{2}-\d{2})$/;

/**
 * Auto-formats a date input as the user types, inserting the locale's separators.
 *
 * @param previous - The input's text before the edit.
 * @param current - The input's text after the edit.
 * @param caret - The caret position in `current`.
 * @param inputType - `InputEvent.inputType` of the edit.
 * @param data - `InputEvent.data` of the edit.
 * @param count - 1 for a date, 2 for a range.
 */
export function maskDateInput(
  format: NumericDateFormat,
  previous: string,
  current: string,
  caret: number,
  inputType: string,
  data: string | null,
  count = 1,
): MaskedInput {
  // A pasted or dropped ISO date or interval (e.g. from a spreadsheet) is unambiguous.
  if (inputType === 'insertFromPaste' || inputType === 'insertFromDrop') {
    const text = current.trim();
    const interval = ISO_INTERVAL.exec(text);
    let value: string | null = null;
    if (count === 1 && isISODate(text)) value = format.format(text);
    if (count === 2 && interval && isISODate(interval[1]) && isISODate(interval[2])) {
      const [a, b] = [interval[1], interval[2]].sort() as [string, string];
      value = format.formatRange(a, b);
    }
    if (value !== null) return { value, caret: value.length };
  }

  const deleting = inputType.startsWith('delete');
  let digits = current.replace(/\D/g, '');
  let before = countDigits(current.slice(0, caret));

  // Backspace over a separator removed no digit, and re-masking would put the separator right
  // back. Delete the digit before it instead, so Backspace never gets stuck.
  if (
    inputType === 'deleteContentBackward' &&
    digits === previous.replace(/\D/g, '') &&
    before > 0
  ) {
    digits = digits.slice(0, before - 1) + digits.slice(before);
    before -= 1;
  }

  // Typing a separator early ("1/") completes the field with a leading zero ("01/").
  if (inputType === 'insertText' && data && /\D/.test(data) && caret === current.length) {
    let offset = 0;
    for (const field of format.fields(count)) {
      const length = FIELD_LENGTH[field];
      const filled = Math.min(Math.max(digits.length - offset, 0), length);
      if (filled < length) {
        if (filled > 0 && field !== 'year') {
          const at = digits.length - filled;
          digits = digits.slice(0, at) + '0'.repeat(length - filled) + digits.slice(at);
          before = digits.length;
        }
        break;
      }
      offset += length;
    }
  }

  digits = digits.slice(0, DIGITS_PER_DATE * count);
  before = Math.min(before, digits.length);
  const atEnd = before === digits.length;
  const value = format.mask(digits, !deleting && atEnd, count);

  if (atEnd) return { value, caret: value.length };
  let seen = 0;
  let position = 0;
  while (position < value.length && seen < before) {
    if (/\d/.test(value.charAt(position))) seen += 1;
    position += 1;
  }
  // When typing, step over a separator so the next digit goes into the next field.
  if (!deleting) while (position < value.length && /\D/.test(value.charAt(position))) position += 1;
  return { value, caret: position };
}
