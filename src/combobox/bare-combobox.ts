import { ReactiveElement, type PropertyValues } from 'lit';
import type { BareChangeDetail } from '../listbox/events.js';
import type { BareListbox } from '../listbox/bare-listbox.js';
import { OPTION_UPDATE_EVENT, type BareOption } from '../listbox/bare-option.js';
import { uniqueId } from '../internal/id.js';

export type ComboboxFilter = 'contains' | 'starts-with' | 'none';

export type { BareChangeDetail };

/**
 * An editable combobox with a filtered popup list, following the WAI-ARIA
 * "list autocomplete with manual selection" pattern.
 *
 * Everything lives in the light DOM, so `aria-activedescendant` and `aria-controls` resolve and
 * you style it with ordinary CSS. Bring your own `<input>` and label:
 *
 * ```html
 * <label for="country">Country</label>
 * <bare-combobox name="country">
 *   <input id="country" />
 *   <bare-listbox>
 *     <bare-option value="br">Brazil</bare-option>
 *     <bare-option value="pt">Portugal</bare-option>
 *   </bare-listbox>
 * </bare-combobox>
 * ```
 *
 * @attr name - Name used when the combobox is submitted with a form.
 * @attr value - Value of the chosen option.
 * @attr filter - `contains` (default), `starts-with`, or `none` to filter options yourself
 *   (for example from a server) while keeping every option visible.
 * @attr open - Reflected while the list is shown.
 * @attr filled - Reflected while the input has text. Handy to hide a clear button when empty.
 * @attr loading - Set while you fetch options. Marks the listbox `aria-busy`; style a spinner or
 *   status message with `bare-combobox[loading]`.
 *
 * Put any element with `data-clear` inside (typically a `<button type="button">` with an
 * `aria-label`) to get a clear button: it empties the text and the selection, closes the list and
 * returns focus to the input.
 *
 * @fires bare-change - When an option is chosen or the selection is cleared by editing the text.
 */
export class BareCombobox extends ReactiveElement {
  static formAssociated = true;

  static override properties = {
    value: { type: String },
    open: { type: Boolean, reflect: true },
    loading: { type: Boolean, reflect: true },
    filled: { type: Boolean, reflect: true },
    filter: { type: String },
    name: { type: String },
  };

  declare value: string;
  declare open: boolean;
  declare loading: boolean;
  /** Whether the input has text. Read-only: kept in sync by the element. */
  declare filled: boolean;
  declare filter: ComboboxFilter;
  declare name: string;

  readonly #internals: ElementInternals;
  readonly #observer = new MutationObserver(() => this.#requestSync());
  #syncQueued = false;
  #input: HTMLInputElement | null = null;
  #inputListeners: AbortController | null = null;
  #listbox: BareListbox | null = null;
  #listboxListeners: AbortController | null = null;
  #clearButton: Element | null = null;
  #clearListeners: AbortController | null = null;
  #active: BareOption | null = null;
  #query = '';
  /**
   * The value whose label was last written into the input. The label is written once per value
   * change (also when its option only shows up later), never on every sync: a sync can run while
   * the user is typing, and must not overwrite their text.
   */
  #labelWrittenFor: string | null = null;

  constructor() {
    super();
    this.value = '';
    this.open = false;
    this.loading = false;
    this.filled = false;
    this.filter = 'contains';
    this.name = '';
    this.#internals = this.attachInternals();
    this.addEventListener(OPTION_UPDATE_EVENT, () => this.#requestSync());
  }

  /** The highlighted option, if any. */
  get activeOption(): BareOption | null {
    return this.#active;
  }

  /** The option holding the current value, if any. */
  get selectedOption(): BareOption | null {
    return this.#options.find((o) => o.selected) ?? null;
  }

  get form(): HTMLFormElement | null {
    return this.#internals.form;
  }

  protected override createRenderRoot() {
    return this;
  }

  override connectedCallback() {
    super.connectedCallback();
    // Children may be parsed, or replaced (e.g. async results), after we connect.
    this.#observer.observe(this, { childList: true, subtree: true });
    this.#sync();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#observer.disconnect();
    this.#inputListeners?.abort();
    this.#listboxListeners?.abort();
    this.#clearListeners?.abort();
    this.#input = null;
    this.#clearButton = null;
    this.#listbox = null;
  }

  protected override updated(changed: PropertyValues<this>) {
    if (changed.has('open')) {
      this.#input?.setAttribute('aria-expanded', String(this.open));
      if (this.#listbox) this.#listbox.hidden = !this.open;
      if (!this.open) this.#setActive(null);
    }
    if (changed.has('value')) {
      this.#labelWrittenFor = null;
      this.#syncSelection();
      this.#internals.setFormValue(this.value || null);
    }
    if (changed.has('loading')) this.#syncBusy();
    if (changed.has('filter')) this.#applyFilter();
  }

  formResetCallback() {
    this.value = '';
    this.#query = '';
    if (this.#input) this.#input.value = '';
    this.#applyFilter();
    this.#syncFilled();
  }

  formStateRestoreCallback(state: string | null) {
    this.value = state ?? '';
  }

  // --- Wiring -------------------------------------------------------------------------------

  get #options(): BareOption[] {
    return this.#listbox ? [...this.#listbox.querySelectorAll('bare-option')] : [];
  }

  get #navigable(): BareOption[] {
    return this.#options.filter((o) => !o.hidden && !o.disabled);
  }

  /** Coalesces bursts (many options upgrading at once) into one sync. */
  #requestSync() {
    if (this.#syncQueued) return;
    this.#syncQueued = true;
    queueMicrotask(() => {
      this.#syncQueued = false;
      if (this.isConnected) this.#sync();
    });
  }

  #sync() {
    const input = this.querySelector('input');
    if (input !== this.#input) this.#bindInput(input);

    const listbox = this.querySelector('bare-listbox');
    if (listbox !== this.#listbox) this.#bindListbox(listbox);

    const clearButton = this.querySelector('[data-clear]');
    if (clearButton !== this.#clearButton) this.#bindClearButton(clearButton);

    // The listbox may not have upgraded yet, so make sure it has an id we can point to.
    if (listbox && !listbox.id) listbox.id = uniqueId('bare-listbox');

    if (input && listbox) {
      input.setAttribute('role', 'combobox');
      input.setAttribute('aria-autocomplete', 'list');
      input.setAttribute('aria-controls', listbox.id);
      input.setAttribute('aria-expanded', String(this.open));
      input.setAttribute('autocomplete', 'off');
    }
    if (listbox) listbox.hidden = !this.open;
    this.#syncBusy();

    this.#syncSelection();
    this.#applyFilter();
    this.#syncFilled();
    if (this.#active && !this.#navigable.includes(this.#active)) this.#setActive(null);
  }

  #bindInput(input: HTMLInputElement | null) {
    this.#inputListeners?.abort();
    this.#input = input;
    if (!input) return;
    const { signal } = (this.#inputListeners = new AbortController());
    input.addEventListener('keydown', (e) => this.#onKeydown(e), { signal });
    input.addEventListener('input', () => this.#onInput(), { signal });
    input.addEventListener('click', () => this.#show(), { signal });
    input.addEventListener('blur', () => (this.open = false), { signal });
  }

  #bindListbox(listbox: BareListbox | null) {
    this.#listboxListeners?.abort();
    this.#listbox = listbox;
    if (!listbox) return;
    const { signal } = (this.#listboxListeners = new AbortController());
    const optionFrom = (e: Event) => (e.target as Element).closest('bare-option');
    // Keep focus in the input while the pointer is used on the list.
    listbox.addEventListener('mousedown', (e) => e.preventDefault(), { signal });
    listbox.addEventListener(
      'click',
      (e) => {
        const option = optionFrom(e);
        if (option && !option.disabled) this.#choose(option);
      },
      { signal },
    );
    listbox.addEventListener(
      'mousemove',
      (e) => {
        // Over a disabled option or the gaps between options, nothing is highlighted.
        const option = optionFrom(e);
        const target = option && !option.disabled ? option : null;
        if (target !== this.#active) this.#setActive(target);
      },
      { signal },
    );
    listbox.addEventListener('mouseleave', () => this.#setActive(null), { signal });
  }

  #bindClearButton(button: Element | null) {
    this.#clearListeners?.abort();
    this.#clearButton = button;
    if (!button) return;
    const { signal } = (this.#clearListeners = new AbortController());
    // Don't let the press blur the input (which would close and reopen the list).
    button.addEventListener('mousedown', (e) => e.preventDefault(), { signal });
    button.addEventListener(
      'click',
      (e) => {
        e.preventDefault(); // never submit a form, whatever the button type
        this.#clearText();
        this.#input?.focus();
      },
      { signal },
    );
  }

  // --- Behavior -----------------------------------------------------------------------------

  #onKeydown(e: KeyboardEvent) {
    if (e.isComposing) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.open) {
          this.#show();
          if (!e.altKey) this.#setActive(this.#firstChoice(), true);
        } else {
          this.#move(1);
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (!this.open) {
          this.#show();
          if (!e.altKey) this.#setActive(this.#navigable.at(-1) ?? null, true);
        } else if (e.altKey) {
          this.open = false;
        } else {
          this.#move(-1);
        }
        break;

      case 'Enter':
        // Without a highlighted option, Enter falls through to the form (e.g. submit).
        if (this.open && this.#active) {
          e.preventDefault();
          this.#choose(this.#active);
        }
        break;

      case 'Escape':
        if (this.open) {
          e.preventDefault();
          this.open = false;
        } else if (this.#input?.value) {
          e.preventDefault();
          this.#clearText();
        }
        break;

      case 'Tab':
        this.open = false;
        break;
    }
  }

  #onInput() {
    const text = this.#input?.value ?? '';
    this.#query = text;
    this.#syncFilled();

    if (this.value && text !== this.selectedOption?.label) {
      this.value = '';
      this.#emitChange(null);
    }

    this.#applyFilter();
    this.#setActive(null);
    this.open = this.#navigable.length > 0;
  }

  /**
   * Empties the text as if the user deleted it, so apps listening to `input` (e.g. to run a
   * search) react too, then keeps the list closed.
   */
  #clearText() {
    const input = this.#input;
    if (!input) return;
    input.value = '';
    input.dispatchEvent(
      new InputEvent('input', { bubbles: true, composed: true, inputType: 'deleteContent' }),
    );
    this.open = false;
  }

  #show() {
    if (this.#navigable.length > 0) this.open = true;
  }

  #move(delta: 1 | -1) {
    const options = this.#navigable;
    if (options.length === 0) return;
    const index = this.#active ? options.indexOf(this.#active) : -1;
    const next =
      index === -1
        ? delta === 1
          ? 0
          : options.length - 1
        : (index + delta + options.length) % options.length;
    this.#setActive(options[next] ?? null, true);
  }

  #firstChoice(): BareOption | null {
    const options = this.#navigable;
    return options.find((o) => o.selected) ?? options[0] ?? null;
  }

  #setActive(option: BareOption | null, scroll = false) {
    if (this.#active) this.#active.active = false;
    this.#active = option;
    if (option) {
      option.active = true;
      this.#input?.setAttribute('aria-activedescendant', option.id);
      if (scroll) option.scrollIntoView({ block: 'nearest' });
    } else {
      this.#input?.removeAttribute('aria-activedescendant');
    }
  }

  #choose(option: BareOption) {
    const changed = option.optionValue !== this.value;
    this.value = option.optionValue;
    if (this.#input) this.#input.value = option.label;
    this.#syncFilled();
    // Reopening after a choice shows the whole list again, not just the chosen match.
    this.#query = '';
    this.#applyFilter();
    this.open = false;
    if (changed) this.#emitChange(option);
  }

  #syncSelection() {
    let selected: BareOption | null = null;
    for (const option of this.#options) {
      option.selected = this.value !== '' && option.optionValue === this.value && !selected;
      if (option.selected) selected = option;
    }
    if (selected && this.#input && this.#labelWrittenFor !== this.value) {
      this.#input.value = selected.label;
      this.#labelWrittenFor = this.value;
      this.#syncFilled();
    }
  }

  #syncFilled() {
    this.filled = (this.#input?.value ?? '') !== '';
  }

  #syncBusy() {
    if (!this.#listbox) return;
    if (this.loading) this.#listbox.setAttribute('aria-busy', 'true');
    else this.#listbox.removeAttribute('aria-busy');
  }

  #applyFilter() {
    const query = this.#query.trim().toLocaleLowerCase();
    for (const option of this.#options) {
      const label = option.label.toLocaleLowerCase();
      const match =
        this.filter === 'none' ||
        query === '' ||
        (this.filter === 'starts-with' ? label.startsWith(query) : label.includes(query));
      option.hidden = !match;
    }
  }

  #emitChange(option: BareOption | null) {
    this.dispatchEvent(
      new CustomEvent<BareChangeDetail>('bare-change', {
        detail: { value: this.value, option },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bare-combobox': BareCombobox;
  }
}
