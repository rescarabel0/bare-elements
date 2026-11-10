import { LitElement, html, nothing, type PropertyValues } from 'lit';
import { uniqueId } from '../internal/id.js';
import type { BareChangeDetail } from '../listbox/events.js';
import '../select/index.js';
import {
  addDays,
  addMonths,
  clampDate,
  daysInMonth,
  endOfMonth,
  firstDayOfWeek,
  isISODate,
  isSameMonth,
  parseISODate,
  startOfMonth,
  startOfWeek,
  toISODate,
  toUTCDate,
  todayISODate,
} from '../internal/date.js';

/** A named group of dates, e.g. days with data or days that failed. */
export interface CalendarMarker {
  /** Shown in the legend and appended to each marked day's accessible name. */
  label: string;
  /** Dates as `YYYY-MM-DD`. */
  dates: readonly string[];
}

/** Markers by key. The key is what you style: `[data-marker="failed"]`. */
export type CalendarMarkers = Record<string, CalendarMarker>;

export type CalendarSelection = 'single' | 'range';

export interface BareCalendarChangeDetail {
  /** The chosen date, `YYYY-MM-DD` (single selection; `''` in range mode). */
  value: string;
  /** First day of the chosen range, `YYYY-MM-DD` (range mode; `''` otherwise). */
  start: string;
  /** Last day of the chosen range, `YYYY-MM-DD` (range mode; `''` otherwise). */
  end: string;
}

/**
 * A month grid for picking one date, following the WAI-ARIA date picker grid pattern.
 *
 * Renders its own markup into the light DOM, so you style it with plain CSS. Hooks:
 *
 * - `[data-part="header"]`, `[data-part="prev"]`, `[data-part="next"]`. The arrows default to
 *   ‹ and ›; put your own icon (SVG, icon font, image, emoji…) inside the calendar with
 *   `data-prev-icon` / `data-next-icon` and it is moved into the button
 * - `[data-part="month-select"]` and `[data-part="year-select"]`: `<bare-select>`s to jump to a
 *   month or year, styled like any `<bare-select>` (`[data-trigger]`, `bare-listbox`, `bare-option`)
 * - `[data-part="title"]`: "November 2026", a live region announcing month changes. The selects
 *   already show it, so you will usually hide it visually (not with `display: none`)
 * - `[data-part="grid"]` (a `<table>`), `[data-part="weekday"]` (each `<th>`)
 * - `[data-part="day"]` (each day `<button>`) with `[data-today]`, `[data-selected]`,
 *   `[data-unavailable]`, and `:focus-visible` for the roving focus
 * - In range mode, also `[data-range-start]`, `[data-range-end]` and `[data-in-range]` (days
 *   strictly between), plus `[data-preview]` on all of them while the end is still being picked
 *
 * Markers group dates with a meaning (see `markers`). A marked day gets
 * `[data-markers~="<key>"]` and one `[data-part="marker"][data-marker="<key>"]` element per
 * marker inside its button (for dots); its accessible name ends with the marker labels, so the
 * meaning never relies on color alone. A `[data-part="legend"]` list with one
 * `[data-part="legend-item"][data-marker="<key>"]` per marker follows the grid, unless
 * `hide-legend` is set.
 *
 * Keyboard: arrows move by day and week, Home/End to week start/end, PageUp/PageDown by month,
 * Shift+PageUp/PageDown by year, Enter/Space chooses. In range mode, Escape cancels a range
 * whose end hasn't been picked yet.
 *
 * @attr selection - `single` (default) or `range`. In range mode the first choice sets the start,
 *   hovering or moving focus previews the range, and the second choice sets the end (the two are
 *   swapped if the end comes first).
 * @attr value - Chosen date, `YYYY-MM-DD` (single selection).
 * @attr start - First day of the chosen range, `YYYY-MM-DD` (range mode).
 * @attr end - Last day of the chosen range, `YYYY-MM-DD` (range mode).
 * @attr name - Submits the selection with a form: the date, or the range as an ISO 8601
 *   interval (`2026-11-02/2026-11-05`).
 * @attr min - Earliest selectable date, `YYYY-MM-DD`.
 * @attr max - Latest selectable date, `YYYY-MM-DD`.
 * @attr locale - BCP 47 locale for names and week start. Defaults to the page's `lang`.
 * @attr first-day-of-week - 0 (Sunday) to 6 (Saturday). Defaults to the locale's.
 * @attr prev-label - Accessible name of the previous-month button.
 * @attr next-label - Accessible name of the next-month button.
 * @attr month-label - Accessible name of the month select.
 * @attr year-label - Accessible name of the year select.
 * @attr hide-legend - Don't render the markers legend (e.g. you show your own).
 *
 * @fires bare-change - When a date is chosen, or a range is completed.
 */
export class BareCalendar extends LitElement {
  static formAssociated = true;

  static override properties = {
    value: { type: String },
    start: { type: String },
    end: { type: String },
    selection: { type: String },
    name: { type: String },
    min: { type: String },
    max: { type: String },
    locale: { type: String },
    firstDayOfWeek: { type: Number, attribute: 'first-day-of-week' },
    prevLabel: { type: String, attribute: 'prev-label' },
    nextLabel: { type: String, attribute: 'next-label' },
    monthLabel: { type: String, attribute: 'month-label' },
    yearLabel: { type: String, attribute: 'year-label' },
    isDateDisabled: { attribute: false },
    markers: { attribute: false },
    hideLegend: { type: Boolean, attribute: 'hide-legend' },
    _focused: { state: true },
    _preview: { state: true },
  };

  declare value: string;
  declare start: string;
  declare end: string;
  declare selection: CalendarSelection;
  declare name: string;
  declare min: string;
  declare max: string;
  declare locale: string;
  declare firstDayOfWeek: number | undefined;
  declare prevLabel: string;
  declare nextLabel: string;
  declare monthLabel: string;
  declare yearLabel: string;
  /** Marks extra dates unavailable (e.g. weekends, booked days). Receives `YYYY-MM-DD`. */
  declare isDateDisabled: ((date: string) => boolean) | undefined;
  /**
   * Named groups of dates, rendered as hooks to style and listed in a legend. A day can be in
   * several groups.
   *
   * ```js
   * calendar.markers = {
   *   ok: { label: 'Has data', dates: ['2026-11-02', '2026-11-03'] },
   *   failed: { label: 'Failed', dates: ['2026-11-03'] },
   * };
   * ```
   */
  declare markers: CalendarMarkers;
  declare hideLegend: boolean;
  /** The date holding the roving tab stop. Also decides which month is shown. */
  declare _focused: string;
  /** While a range's end is being picked: the hovered or focused day. */
  declare _preview: string;

  readonly #titleId = uniqueId('bare-calendar-title');
  /** Move DOM focus to the roving day after the next render (keyboard navigation). */
  #focusAfterRender = false;
  readonly #internals: ElementInternals;
  #defaults: { value: string; start: string; end: string } | null = null;
  /** The last complete range, restored when a pending one is cancelled with Escape. */
  #committed = { start: '', end: '' };
  /** Icons the author put inside the calendar, moved into the arrow buttons on render. */
  #prevIcon: Element | null = null;
  #nextIcon: Element | null = null;

  constructor() {
    super();
    this.value = '';
    this.start = '';
    this.end = '';
    this.selection = 'single';
    this.name = '';
    this.#internals = this.attachInternals();
    this.min = '';
    this.max = '';
    this.locale = '';
    this.firstDayOfWeek = undefined;
    this.prevLabel = 'Previous month';
    this.nextLabel = 'Next month';
    this.monthLabel = 'Month';
    this.yearLabel = 'Year';
    this.isDateDisabled = undefined;
    this.markers = {};
    this.hideLegend = false;
    this._focused = todayISODate();
    this._preview = '';
  }

  /** The date that has (or would get) keyboard focus in the grid. */
  get focusedDate(): string {
    return this._focused;
  }

  /** Shows the month of `date` and gives that day the tab stop, without moving focus. */
  set focusedDate(date: string) {
    if (isISODate(date)) this._focused = clampDate(date, this.#min, this.#max);
  }

  /** Focuses the roving day button: the chosen date, or today. */
  override focus(options?: FocusOptions) {
    const button = this.#dayButton(this._focused);
    if (button) button.focus(options);
    else {
      this.#focusAfterRender = true;
      this.requestUpdate();
    }
  }

  /** Icons can arrive after we connect (e.g. while the parser streams children). */
  readonly #iconObserver = new MutationObserver(() => {
    if (this.querySelector(':scope > [data-prev-icon], :scope > [data-next-icon]')) {
      this.requestUpdate();
    }
  });

  protected override createRenderRoot() {
    return this;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#iconObserver.observe(this, { childList: true });
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#iconObserver.disconnect();
  }

  /** Moves author-provided icons out of the way; render() puts them into the arrow buttons. */
  #adoptIcons() {
    const prev = this.querySelector(':scope > [data-prev-icon]');
    const next = this.querySelector(':scope > [data-next-icon]');
    if (prev) this.#prevIcon = (prev.remove(), prev);
    if (next) this.#nextIcon = (next.remove(), next);
  }

  get form(): HTMLFormElement | null {
    return this.#internals.form;
  }

  get #range(): boolean {
    return this.selection === 'range';
  }

  /** In range mode: a start is picked and the end isn't yet. */
  get #pending(): boolean {
    return this.#range && isISODate(this.start) && !isISODate(this.end);
  }

  /** The range to draw: the chosen one, or the preview while pending. */
  get #shownRange(): { from: string; to: string } | null {
    if (!this.#range || !isISODate(this.start)) return null;
    const other = this.#pending ? this._preview || this.start : this.end;
    return this.start <= other ? { from: this.start, to: other } : { from: other, to: this.start };
  }

  formResetCallback() {
    this.value = this.#defaults?.value ?? '';
    this.start = this.#defaults?.start ?? '';
    this.end = this.#defaults?.end ?? '';
    this.#committed = { start: this.start, end: this.end };
  }

  protected override firstUpdated() {
    this.#defaults = { value: this.value, start: this.start, end: this.end };
    this.#committed = { start: this.start, end: this.end };
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    if (
      changed.has('value') ||
      changed.has('start') ||
      changed.has('end') ||
      changed.has('name') ||
      changed.has('selection')
    ) {
      this.#syncForm();
    }
    // Follow the range start when it changes from outside, so the range is shown.
    if (changed.has('start') && isISODate(this.start) && !this.#pending) {
      this._focused = this.start;
    }
    // Follow the value when it changes from outside, so the chosen month is shown.
    if (changed.has('value') && isISODate(this.value)) this._focused = this.value;
    if (changed.has('min') || changed.has('max')) {
      this._focused = clampDate(this._focused, this.#min, this.#max);
    }
  }

  protected override updated() {
    if (this.#focusAfterRender) {
      this.#focusAfterRender = false;
      this.#dayButton(this._focused)?.focus();
    }
  }

  // --- Rendering ----------------------------------------------------------------------------

  get #locale(): string {
    return this.locale || this.closest('[lang]')?.getAttribute('lang') || navigator.language;
  }

  get #min(): string | null {
    return isISODate(this.min) ? this.min : null;
  }

  get #max(): string | null {
    return isISODate(this.max) ? this.max : null;
  }

  get #weekStart(): number {
    const day = this.firstDayOfWeek;
    return day !== undefined && day >= 0 && day <= 6 ? day : firstDayOfWeek(this.#locale);
  }

  protected override render() {
    this.#adoptIcons();
    const locale = this.#locale;
    const focused = this._focused;
    const first = startOfMonth(focused);
    const last = endOfMonth(focused);
    const weekStart = this.#weekStart;

    const monthTitle = new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(toUTCDate(first));
    const monthName = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' });
    const shortDay = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
    const longDay = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });
    const fullDate = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' });
    const dayNumber = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' });

    const gridStart = startOfWeek(first, weekStart);
    const weekdays = Array.from({ length: 7 }, (_, i) => addDays(gridStart, i));
    const weeks: string[][] = [];
    for (let day = gridStart; day <= last;) {
      const week: string[] = [];
      for (let i = 0; i < 7; i++, day = addDays(day, 1)) week.push(day);
      weeks.push(week);
    }

    const shownRange = this.#shownRange;
    const pending = this.#pending;
    const markersByDate = this.#markersByDate();
    const markerEntries = Object.entries(this.markers ?? {});
    const today = todayISODate();
    const min = this.#min;
    const max = this.#max;
    const year = Number(first.slice(0, 4));
    const currentMonth = Number(first.slice(5, 7));
    const prevDisabled = min !== null && addDays(first, -1) < min;
    const nextDisabled = max !== null && addDays(last, 1) > max;

    return html`
      <div data-part="header">
        <button
          type="button"
          data-part="prev"
          aria-label=${this.prevLabel}
          ?disabled=${prevDisabled}
          @click=${() => this.#moveMonth(-1)}
        >
          ${this.#prevIcon ?? '‹'}
        </button>
        <bare-select
          data-part="month-select"
          .value=${String(currentMonth)}
          @bare-change=${(e: CustomEvent<BareChangeDetail>) => {
            e.stopPropagation(); // the calendar's own bare-change means "date chosen"
            this.#jumpTo({ month: Number(e.detail.value) });
          }}
        >
          <button type="button" data-trigger aria-label=${this.monthLabel}></button>
          <bare-listbox>
            ${Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
              const start = toISODate({ year, month, day: 1 });
              const outOfRange =
                (min !== null && endOfMonth(start) < min) || (max !== null && start > max);
              return html`<bare-option value=${month} ?disabled=${outOfRange}>
                ${monthName.format(toUTCDate(start))}
              </bare-option>`;
            })}
          </bare-listbox>
        </bare-select>
        <bare-select
          data-part="year-select"
          .value=${String(year)}
          @bare-change=${(e: CustomEvent<BareChangeDetail>) => {
            e.stopPropagation();
            this.#jumpTo({ year: Number(e.detail.value) });
          }}
        >
          <button type="button" data-trigger aria-label=${this.yearLabel}></button>
          <bare-listbox>
            ${this.#yearRange(year).map((y) => html`<bare-option value=${y}>${y}</bare-option>`)}
          </bare-listbox>
        </bare-select>
        <div data-part="title" id=${this.#titleId} aria-live="polite">${monthTitle}</div>
        <button
          type="button"
          data-part="next"
          aria-label=${this.nextLabel}
          ?disabled=${nextDisabled}
          @click=${() => this.#moveMonth(1)}
        >
          ${this.#nextIcon ?? '›'}
        </button>
      </div>
      <table
        role="grid"
        data-part="grid"
        aria-labelledby=${this.#titleId}
        aria-multiselectable=${this.#range ? 'true' : nothing}
        @mouseleave=${() => {
          if (this.#pending) this._preview = this._focused;
        }}
        @keydown=${this.#onKeydown}
      >
        <thead>
          <tr>
            ${weekdays.map(
              (day) => html`
                <th scope="col" data-part="weekday" abbr=${longDay.format(toUTCDate(day))}>
                  ${shortDay.format(toUTCDate(day))}
                </th>
              `,
            )}
          </tr>
        </thead>
        <tbody>
          ${weeks.map(
            (week) => html`
              <tr>
                ${week.map((day) => {
                  if (!isSameMonth(day, first)) return html`<td></td>`;
                  const range = shownRange;
                  const inShown = range !== null && day >= range.from && day <= range.to;
                  const selected = this.#range
                    ? inShown && (!pending || day === this.start)
                    : day === this.value;
                  const unavailable = this.#isUnavailable(day);
                  const marks = markersByDate.get(day) ?? [];
                  const label = [
                    fullDate.format(toUTCDate(day)),
                    ...marks.map((key) => this.markers[key]?.label ?? key),
                  ].join(', ');
                  return html`
                    <td role="gridcell" aria-selected=${selected ? 'true' : 'false'}>
                      <button
                        type="button"
                        data-part="day"
                        data-date=${day}
                        tabindex=${day === focused ? 0 : -1}
                        aria-label=${label}
                        data-markers=${marks.length > 0 ? marks.join(' ') : nothing}
                        aria-current=${day === today ? 'date' : nothing}
                        aria-disabled=${unavailable ? 'true' : nothing}
                        ?data-today=${day === today}
                        ?data-selected=${selected}
                        ?data-unavailable=${unavailable}
                        ?data-range-start=${range !== null && day === range.from}
                        ?data-range-end=${range !== null && day === range.to}
                        ?data-in-range=${range !== null && day > range.from && day < range.to}
                        ?data-preview=${pending && inShown}
                        @mouseenter=${() => {
                          if (this.#pending) this._preview = day;
                        }}
                        @click=${() => this.#choose(day)}
                      >
                        ${dayNumber.format(toUTCDate(day))}
                        ${
                          marks.length > 0
                            ? html`<span data-part="markers" aria-hidden="true"
                                >${marks.map(
                                  (key) =>
                                    html`<span data-part="marker" data-marker=${key}></span>`,
                                )}</span
                              >`
                            : nothing
                        }
                      </button>
                    </td>
                  `;
                })}
              </tr>
            `,
          )}
        </tbody>
      </table>
      ${
        markerEntries.length > 0 && !this.hideLegend
          ? html`<ul data-part="legend">
              ${markerEntries.map(
                ([key, marker]) =>
                  html`<li data-part="legend-item" data-marker=${key}>${marker.label}</li>`,
              )}
            </ul>`
          : nothing
      }
    `;
  }

  // --- Behavior -----------------------------------------------------------------------------

  #markersCache: { markers: CalendarMarkers; byDate: Map<string, string[]> } | null = null;

  /** Date -> marker keys, rebuilt only when `markers` is replaced. */
  #markersByDate(): Map<string, string[]> {
    const markers = this.markers ?? {};
    if (this.#markersCache?.markers === markers) return this.#markersCache.byDate;
    const byDate = new Map<string, string[]>();
    for (const [key, { dates }] of Object.entries(markers)) {
      for (const date of dates) {
        const keys = byDate.get(date);
        if (keys) keys.push(key);
        else byDate.set(date, [key]);
      }
    }
    this.#markersCache = { markers, byDate };
    return byDate;
  }

  #isUnavailable(day: string): boolean {
    const min = this.#min;
    const max = this.#max;
    return (
      (min !== null && day < min) ||
      (max !== null && day > max) ||
      (this.isDateDisabled?.(day) ?? false)
    );
  }

  #dayButton(day: string): HTMLButtonElement | null {
    return this.querySelector(`[data-part="day"][data-date="${day}"]`);
  }

  #moveFocus(day: string) {
    this._focused = clampDate(day, this.#min, this.#max);
    if (this.#pending) this._preview = this._focused;
    this.#focusAfterRender = true;
  }

  /** Years offered in the year select: `min`..`max`, else 100 years back to 20 ahead. */
  #yearRange(shown: number): number[] {
    const thisYear = Number(todayISODate().slice(0, 4));
    let from = this.#min ? Number(this.#min.slice(0, 4)) : thisYear - 100;
    let to = this.#max ? Number(this.#max.slice(0, 4)) : thisYear + 20;
    from = Math.min(from, shown);
    to = Math.max(to, shown);
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }

  /** Shows another month or year from the selects, keeping the day where possible. */
  #jumpTo(change: { year?: number; month?: number }) {
    const { year, month, day } = parseISODate(this._focused) ?? { year: 0, month: 1, day: 1 };
    const target = { year: change.year ?? year, month: change.month ?? month };
    const clampedDay = Math.min(day, daysInMonth(target.year, target.month));
    this._focused = clampDate(toISODate({ ...target, day: clampedDay }), this.#min, this.#max);
  }

  #moveMonth(delta: number) {
    // Keep the tab stop in view without stealing focus from the header button.
    this._focused = clampDate(addMonths(this._focused, delta), this.#min, this.#max);
    // At min/max the pressed arrow becomes disabled, and a disabled button drops focus to
    // <body>. Hand focus to the grid instead so the user (and any popup around us) keeps it.
    const part = delta < 0 ? 'prev' : 'next';
    void this.updateComplete.then(() => {
      const arrow = this.querySelector<HTMLButtonElement>(`[data-part="${part}"]`);
      const lostFocus =
        document.activeElement === document.body || document.activeElement === arrow;
      if (arrow?.disabled && lostFocus) this.#dayButton(this._focused)?.focus();
    });
  }

  #onKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.dataset['part'] !== 'day') return;
    const day = this._focused;
    const rtl = getComputedStyle(this).direction === 'rtl';
    const weekStart = this.#weekStart;

    if (e.key === 'Escape' && this.#pending) {
      e.preventDefault();
      e.stopPropagation(); // cancel the range only, not a surrounding popup
      this.start = this.#committed.start;
      this.end = this.#committed.end;
      return;
    }

    let next: string | null = null;
    switch (e.key) {
      case 'ArrowRight':
        next = addDays(day, rtl ? -1 : 1);
        break;
      case 'ArrowLeft':
        next = addDays(day, rtl ? 1 : -1);
        break;
      case 'ArrowDown':
        next = addDays(day, 7);
        break;
      case 'ArrowUp':
        next = addDays(day, -7);
        break;
      case 'Home':
        next = startOfWeek(day, weekStart);
        break;
      case 'End':
        next = addDays(startOfWeek(day, weekStart), 6);
        break;
      case 'PageUp':
        next = addMonths(day, e.shiftKey ? -12 : -1);
        break;
      case 'PageDown':
        next = addMonths(day, e.shiftKey ? 12 : 1);
        break;
    }
    if (next !== null) {
      e.preventDefault();
      this.#moveFocus(next);
    }
  }

  #choose(day: string) {
    this._focused = day;
    if (this.#isUnavailable(day)) return;

    if (!this.#range) {
      this.value = day;
      this.#emitChange();
      return;
    }
    if (!this.#pending) {
      // First pick: start a new range and preview from here.
      this.start = day;
      this.end = '';
      this._preview = day;
      return;
    }
    const [start, end] = this.start <= day ? [this.start, day] : [day, this.start];
    this.start = start;
    this.end = end;
    this._preview = '';
    this.#committed = { start, end };
    this.#emitChange();
  }

  #emitChange() {
    const range = this.#range;
    this.dispatchEvent(
      new CustomEvent<BareCalendarChangeDetail>('bare-change', {
        detail: {
          value: range ? '' : this.value,
          start: range ? this.start : '',
          end: range ? this.end : '',
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #syncForm() {
    if (!this.#range) {
      this.#internals.setFormValue(this.value || null);
      return;
    }
    const complete = isISODate(this.start) && isISODate(this.end);
    this.#internals.setFormValue(complete ? `${this.start}/${this.end}` : null);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bare-calendar': BareCalendar;
  }
}
