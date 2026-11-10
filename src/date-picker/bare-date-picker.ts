import { ReactiveElement, type PropertyValues } from 'lit';
import { uniqueId } from '../internal/id.js';
import { NumericDateFormat, isISODate, maskDateInput } from '../internal/date.js';
import type { BareCalendar, BareCalendarChangeDetail, CalendarMarkers } from './bare-calendar.js';

export interface BareDatePickerChangeDetail {
  /** The new date as `YYYY-MM-DD`, or `''` when cleared or invalid. */
  value: string;
}

/**
 * A date field with a calendar popup, following the WAI-ARIA "Date Picker Dialog" pattern.
 *
 * Bring your own input, toggle button and popup; everything stays in the light DOM:
 *
 * ```html
 * <label for="due">Due date</label>
 * <bare-date-picker name="due">
 *   <input id="due" />
 *   <button type="button" data-toggle aria-label="Choose date">📅</button>
 *   <div data-popup aria-label="Choose date">
 *     <bare-calendar></bare-calendar>
 *   </div>
 * </bare-date-picker>
 * ```
 *
 * The input accepts typed dates in the locale's numeric format (e.g. `10/11/2026` in pt-BR) and
 * shows the chosen date the same way. The value is always ISO `YYYY-MM-DD`.
 *
 * @attr name - Name used when submitted with a form.
 * @attr value - Chosen date, `YYYY-MM-DD`.
 * @attr min - Earliest allowed date, `YYYY-MM-DD`.
 * @attr max - Latest allowed date, `YYYY-MM-DD`.
 * @attr locale - BCP 47 locale. Defaults to the page's `lang`.
 * @attr required - The form is invalid without a date.
 * @attr open - Reflected while the popup is shown.
 * @attr invalid - Reflected while the typed text is not an allowed date.
 *
 * @fires bare-change - When the value changes, by picking or typing.
 */
export class BareDatePicker extends ReactiveElement {
  static formAssociated = true;

  static override properties = {
    value: { type: String },
    min: { type: String },
    max: { type: String },
    locale: { type: String },
    name: { type: String },
    required: { type: Boolean, reflect: true },
    open: { type: Boolean, reflect: true },
    invalid: { type: Boolean, reflect: true },
  };

  declare value: string;
  declare min: string;
  declare max: string;
  declare locale: string;
  declare name: string;
  declare required: boolean;
  declare open: boolean;
  /** Whether the typed text is not an allowed date. Read-only: kept in sync by the element. */
  declare invalid: boolean;

  #isDateDisabled: ((date: string) => boolean) | undefined = undefined;

  /** Marks extra dates unavailable in the calendar and when typed. Receives `YYYY-MM-DD`. */
  get isDateDisabled() {
    return this.#isDateDisabled;
  }

  set isDateDisabled(fn: ((date: string) => boolean) | undefined) {
    this.#isDateDisabled = fn;
    this.#syncCalendar();
  }

  #markers: CalendarMarkers = {};

  /** Named groups of dates shown in the calendar, with a legend. See `<bare-calendar>`. */
  get markers(): CalendarMarkers {
    return this.#markers;
  }

  set markers(markers: CalendarMarkers) {
    this.#markers = markers;
    this.#syncCalendar();
  }

  readonly #internals: ElementInternals;
  readonly #observer = new MutationObserver(() => this.#sync());
  #input: HTMLInputElement | null = null;
  #toggle: HTMLElement | null = null;
  #popup: HTMLElement | null = null;
  #calendar: BareCalendar | null = null;
  #listeners: AbortController | null = null;

  constructor() {
    super();
    this.value = '';
    this.min = '';
    this.max = '';
    this.locale = '';
    this.name = '';
    this.required = false;
    this.open = false;
    this.invalid = false;
    this.#internals = this.attachInternals();
    this.addEventListener('focusout', (e) => this.#onFocusOut(e));
    this.addEventListener('keydown', (e) => this.#onKeydown(e));
  }

  /** The numeric format used for the input, e.g. `DD/MM/YYYY`. Useful as a placeholder. */
  get formatPattern(): string {
    return this.#format.pattern;
  }

  get form(): HTMLFormElement | null {
    return this.#internals.form;
  }

  get validity(): ValidityState {
    return this.#internals.validity;
  }

  get validationMessage(): string {
    return this.#internals.validationMessage;
  }

  checkValidity(): boolean {
    return this.#internals.checkValidity();
  }

  reportValidity(): boolean {
    return this.#internals.reportValidity();
  }

  protected override createRenderRoot() {
    return this;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#observer.observe(this, { childList: true, subtree: true });
    this.#sync();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#observer.disconnect();
    this.#listeners?.abort();
    this.#input = this.#toggle = this.#popup = this.#calendar = null;
  }

  protected override updated(changed: PropertyValues<this>) {
    if (changed.has('open')) this.#syncOpen();
    if (changed.has('value') || changed.has('locale')) this.#writeInput();
    if (changed.has('value') || changed.has('min') || changed.has('max')) this.#syncCalendar();
    if (changed.has('locale')) this.#syncCalendar();
    this.#syncForm();
  }

  formResetCallback() {
    this.value = '';
    this.invalid = false;
    if (this.#input) this.#input.value = '';
  }

  formStateRestoreCallback(state: string | null) {
    this.value = isISODate(state) ? state : '';
  }

  // --- Wiring -------------------------------------------------------------------------------

  get #format(): NumericDateFormat {
    const locale =
      this.locale || this.closest('[lang]')?.getAttribute('lang') || navigator.language;
    return new NumericDateFormat(locale);
  }

  #sync() {
    const input = this.querySelector('input');
    const toggle = this.querySelector<HTMLElement>('[data-toggle]');
    const popup = this.querySelector<HTMLElement>('[data-popup]');
    const calendar = this.querySelector('bare-calendar');
    if (
      input === this.#input &&
      toggle === this.#toggle &&
      popup === this.#popup &&
      calendar === this.#calendar
    ) {
      return;
    }

    this.#listeners?.abort();
    const { signal } = (this.#listeners = new AbortController());
    this.#input = input;
    this.#toggle = toggle;
    this.#popup = popup;
    this.#calendar = calendar;

    if (input) {
      input.setAttribute('autocomplete', 'off');
      if (!input.hasAttribute('inputmode')) input.inputMode = 'numeric';
      if (!input.placeholder) input.placeholder = this.formatPattern;
      let previous = input.value;
      input.addEventListener('beforeinput', () => (previous = input.value), { signal });
      input.addEventListener(
        'input',
        (e) => {
          if (!(e instanceof InputEvent)) return; // synthetic events carry no edit to mask
          const masked = maskDateInput(
            this.#format,
            previous,
            input.value,
            input.selectionStart ?? input.value.length,
            e.inputType,
            e.data,
          );
          if (masked.value !== input.value) input.value = masked.value;
          input.setSelectionRange(masked.caret, masked.caret);
        },
        { signal },
      );
      input.addEventListener('change', () => this.#commitInput(), { signal });
    }
    if (popup) {
      if (!popup.id) popup.id = uniqueId('bare-date-popup');
      popup.setAttribute('role', 'dialog');
      // A press on the popup's background must not blur everything (which would close it).
      popup.addEventListener(
        'mousedown',
        (e) => {
          const focusable = 'button, input, select, textarea, a[href], [tabindex]';
          if (!(e.target as Element).closest(focusable)) e.preventDefault();
        },
        { signal },
      );
    }
    if (toggle) {
      toggle.setAttribute('aria-haspopup', 'dialog');
      if (popup) toggle.setAttribute('aria-controls', popup.id);
      toggle.addEventListener('click', () => this.#toggleOpen(), { signal });
    }
    calendar?.addEventListener(
      'bare-change',
      (e) => {
        e.stopPropagation(); // re-dispatched from the picker below
        this.#pick((e as Event as CustomEvent<BareCalendarChangeDetail>).detail.value);
      },
      { signal },
    );

    this.#syncOpen();
    this.#syncCalendar();
    this.#writeInput();
    this.#syncForm();
  }

  #syncOpen() {
    if (this.#popup) this.#popup.hidden = !this.open;
    this.#toggle?.setAttribute('aria-expanded', String(this.open));
  }

  #syncCalendar() {
    const calendar = this.#calendar;
    if (!calendar) return;
    calendar.value = this.value;
    calendar.min = this.min;
    calendar.max = this.max;
    if (this.locale) calendar.locale = this.locale;
    calendar.isDateDisabled = this.isDateDisabled;
    calendar.markers = this.#markers;
  }

  #writeInput() {
    if (!this.#input) return;
    // Only rewrite when the value says something different from what's typed, so a partially
    // typed or invalid entry isn't wiped by unrelated updates.
    const typed = this.#format.parse(this.#input.value);
    if (isISODate(this.value) && typed !== this.value) {
      this.#input.value = this.#format.format(this.value);
    } else if (!this.value && !this.invalid && typed) {
      this.#input.value = '';
    }
  }

  #syncForm() {
    this.#internals.setFormValue(this.value || null);
    const anchor = this.#input ?? undefined;
    if (this.invalid) {
      this.#internals.setValidity(
        { badInput: true },
        `Enter a valid date (${this.formatPattern}).`,
        anchor,
      );
    } else if (this.required && !this.value) {
      this.#internals.setValidity({ valueMissing: true }, 'Choose a date.', anchor);
    } else {
      this.#internals.setValidity({});
    }
    if (this.#input) {
      if (this.invalid) this.#input.setAttribute('aria-invalid', 'true');
      else this.#input.removeAttribute('aria-invalid');
    }
  }

  // --- Behavior -----------------------------------------------------------------------------

  #isAllowed(date: string): boolean {
    if (isISODate(this.min) && date < this.min) return false;
    if (isISODate(this.max) && date > this.max) return false;
    return !(this.isDateDisabled?.(date) ?? false);
  }

  #toggleOpen() {
    if (this.open) this.#close(this.#toggle);
    else this.#openPopup();
  }

  #openPopup() {
    this.open = true;
    const calendar = this.#calendar;
    if (!calendar) return;
    // Start on what's typed if it's a date, else the value, else today.
    const typed = this.#input ? this.#format.parse(this.#input.value) : null;
    const start = typed ?? (isISODate(this.value) ? this.value : null);
    if (start) calendar.focusedDate = start;
    void this.updateComplete.then(() => calendar.focus());
  }

  #close(returnFocusTo: HTMLElement | null) {
    this.open = false;
    returnFocusTo?.focus();
  }

  #pick(date: string) {
    this.invalid = false;
    this.#setValue(date);
    this.#close(this.#input);
  }

  /** Parses the typed text when the input commits (blur or Enter). */
  #commitInput() {
    const text = this.#input?.value.trim() ?? '';
    if (text === '') {
      this.invalid = false;
      this.#setValue('');
      return;
    }
    const date = this.#format.parse(text);
    if (date && this.#isAllowed(date)) {
      this.invalid = false;
      this.#setValue(date);
      if (this.#input) this.#input.value = this.#format.format(date); // normalize, e.g. 1/2/26
    } else {
      this.invalid = true;
      this.#setValue('');
    }
  }

  #setValue(value: string) {
    if (value === this.value) return;
    this.value = value;
    this.dispatchEvent(
      new CustomEvent<BareDatePickerChangeDetail>('bare-change', {
        detail: { value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && this.open) {
      e.preventDefault();
      this.#close(this.#toggle ?? this.#input);
      return;
    }
    if (e.target === this.#input) {
      if (e.key === 'ArrowDown' && e.altKey) {
        e.preventDefault();
        this.#openPopup();
      } else if (e.key === 'Enter') {
        this.#commitInput();
      }
    }
  }

  /** Close when focus leaves the whole picker (input, button and popup). */
  #onFocusOut(e: FocusEvent) {
    if (!this.open) return;
    const next = e.relatedTarget as Node | null;
    if (next && this.contains(next)) return;
    // Focus also drops to <body> when the focused element is disabled or removed (e.g. the
    // calendar's arrow at min/max, or a re-render). The user didn't leave; don't close.
    const lost = e.target as HTMLElement;
    if (!next && (!lost.isConnected || lost.matches(':disabled'))) return;
    this.open = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bare-date-picker': BareDatePicker;
  }
}
