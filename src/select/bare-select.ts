import { ReactiveElement, type PropertyValues } from 'lit';
import { uniqueId } from '../internal/id.js';
import type { BareChangeDetail } from '../listbox/events.js';
import type { BareListbox } from '../listbox/bare-listbox.js';
import { OPTION_UPDATE_EVENT, type BareOption } from '../listbox/bare-option.js';

const TYPEAHEAD_RESET_MS = 500;
const PAGE_SIZE = 10;

/**
 * A styleable replacement for `<select>`, following the WAI-ARIA "select-only combobox" pattern.
 *
 * Everything lives in the light DOM and is styled with plain CSS:
 *
 * ```html
 * <label id="size-label">Size</label>
 * <bare-select name="size" value="m">
 *   <button type="button" data-trigger aria-labelledby="size-label"></button>
 *   <bare-listbox>
 *     <bare-option value="s">Small</bare-option>
 *     <bare-option value="m">Medium</bare-option>
 *   </bare-listbox>
 * </bare-select>
 * ```
 *
 * The `[data-trigger]` shows the chosen option's label. Put a `[data-value]` element inside it
 * to keep other content (an icon, a chevron) next to the label. Without a trigger, a `<button>`
 * is created for you.
 *
 * Keyboard: arrows, Home/End and PageUp/PageDown move; Enter or Space opens and chooses; Escape
 * closes; Tab chooses and moves on; typing jumps to the option starting with those letters.
 *
 * @attr name - Name used when submitted with a form.
 * @attr value - Value of the chosen option.
 * @attr placeholder - Shown in the trigger while nothing is chosen.
 * @attr disabled - Cannot be opened or focused.
 * @attr open - Reflected while the list is shown.
 *
 * @fires bare-change - When the user chooses a different option.
 */
export class BareSelect extends ReactiveElement {
  static formAssociated = true;

  static override properties = {
    value: { type: String },
    name: { type: String },
    placeholder: { type: String },
    disabled: { type: Boolean, reflect: true },
    open: { type: Boolean, reflect: true },
  };

  declare value: string;
  declare name: string;
  declare placeholder: string;
  declare disabled: boolean;
  declare open: boolean;

  readonly #internals: ElementInternals;
  readonly #observer = new MutationObserver(() => this.#requestSync());
  #syncQueued = false;
  #trigger: HTMLElement | null = null;
  #listbox: BareListbox | null = null;
  #listeners: AbortController | null = null;
  #active: BareOption | null = null;
  #typeahead = '';
  #typeaheadTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.value = '';
    this.name = '';
    this.placeholder = '';
    this.disabled = false;
    this.open = false;
    this.#internals = this.attachInternals();
    this.addEventListener(OPTION_UPDATE_EVENT, () => this.#requestSync());
  }

  /** The highlighted option while open. */
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

  override focus(options?: FocusOptions) {
    this.#trigger?.focus(options);
  }

  protected override createRenderRoot() {
    return this;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#observer.observe(this, { childList: true, subtree: true, characterData: true });
    this.#sync();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#observer.disconnect();
    this.#listeners?.abort();
    this.#trigger = this.#listbox = null;
  }

  protected override updated(changed: PropertyValues<this>) {
    if (changed.has('open')) {
      this.#trigger?.setAttribute('aria-expanded', String(this.open));
      if (this.#listbox) this.#listbox.hidden = !this.open;
      if (this.open) this.#setActive(this.selectedOption ?? this.#navigable[0] ?? null, true);
      else this.#setActive(null);
    }
    if (changed.has('value') || changed.has('placeholder')) this.#syncSelection();
    if (changed.has('value')) this.#internals.setFormValue(this.value || null);
    if (changed.has('disabled')) this.#syncDisabled();
  }

  formResetCallback() {
    this.value = this.getAttribute('value') ?? '';
  }

  formStateRestoreCallback(state: string | null) {
    this.value = state ?? '';
  }

  formDisabledCallback(disabled: boolean) {
    this.disabled = disabled;
  }

  // --- Wiring -------------------------------------------------------------------------------

  get #options(): BareOption[] {
    return this.#listbox ? [...this.#listbox.querySelectorAll('bare-option')] : [];
  }

  get #navigable(): BareOption[] {
    return this.#options.filter((o) => !o.disabled && !o.hidden);
  }

  #requestSync() {
    if (this.#syncQueued) return;
    this.#syncQueued = true;
    queueMicrotask(() => {
      this.#syncQueued = false;
      if (this.isConnected) this.#sync();
    });
  }

  #sync() {
    let trigger = this.querySelector<HTMLElement>('[data-trigger]');
    if (!trigger) {
      trigger = document.createElement('button');
      trigger.setAttribute('type', 'button');
      trigger.dataset['trigger'] = '';
      this.prepend(trigger);
    }
    const listbox = this.querySelector('bare-listbox');

    if (trigger !== this.#trigger || listbox !== this.#listbox) this.#bind(trigger, listbox);

    if (listbox && !listbox.id) listbox.id = uniqueId('bare-listbox');
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', String(this.open));
    if (listbox) trigger.setAttribute('aria-controls', listbox.id);
    if (listbox) listbox.hidden = !this.open;

    this.#syncDisabled();
    this.#syncSelection();
    if (this.#active && !this.#navigable.includes(this.#active)) this.#setActive(null);
  }

  #bind(trigger: HTMLElement, listbox: BareListbox | null) {
    this.#listeners?.abort();
    const { signal } = (this.#listeners = new AbortController());
    this.#trigger = trigger;
    this.#listbox = listbox;

    trigger.addEventListener('keydown', (e) => this.#onKeydown(e), { signal });
    trigger.addEventListener(
      'click',
      () => {
        if (!this.disabled) this.open = !this.open;
      },
      { signal },
    );
    trigger.addEventListener('blur', () => (this.open = false), { signal });

    if (!listbox) return;
    const optionFrom = (e: Event) => (e.target as Element).closest('bare-option');
    // Keep focus on the trigger while the pointer is used on the list.
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
        const option = optionFrom(e);
        const target = option && !option.disabled ? option : null;
        if (target !== this.#active) this.#setActive(target);
      },
      { signal },
    );
    listbox.addEventListener('mouseleave', () => this.#setActive(null), { signal });
  }

  #syncDisabled() {
    const trigger = this.#trigger;
    if (!trigger) return;
    if (this.disabled) {
      trigger.setAttribute('aria-disabled', 'true');
      if (trigger instanceof HTMLButtonElement) trigger.disabled = true;
      else trigger.removeAttribute('tabindex');
      this.open = false;
    } else {
      trigger.removeAttribute('aria-disabled');
      if (trigger instanceof HTMLButtonElement) trigger.disabled = false;
      else trigger.tabIndex = 0;
    }
  }

  #syncSelection() {
    let selected: BareOption | null = null;
    for (const option of this.#options) {
      option.selected = this.value !== '' && option.optionValue === this.value && !selected;
      if (option.selected) selected = option;
    }

    const trigger = this.#trigger;
    if (!trigger) return;
    const target = trigger.querySelector('[data-value]') ?? trigger;
    const text = selected?.label ?? this.placeholder;
    // Only write on change: writing triggers the observer, which would sync again.
    if (target.textContent !== text) target.textContent = text;
    trigger.toggleAttribute('data-placeholder', !selected);
  }

  // --- Behavior -----------------------------------------------------------------------------

  #onKeydown(e: KeyboardEvent) {
    if (this.disabled) return;
    const options = this.#navigable;
    const index = this.#active ? options.indexOf(this.#active) : -1;
    const moveTo = (i: number) => {
      const option = options[Math.max(0, Math.min(options.length - 1, i))];
      if (option) this.#setActive(option, true);
    };

    if (!this.open) {
      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowUp':
        case 'Enter':
        case ' ':
          e.preventDefault();
          this.open = true;
          return;
        case 'Home':
          e.preventDefault();
          this.open = true;
          void this.updateComplete.then(() => this.#setActive(this.#navigable[0] ?? null, true));
          return;
        case 'End':
          e.preventDefault();
          this.open = true;
          void this.updateComplete.then(() =>
            this.#setActive(this.#navigable.at(-1) ?? null, true),
          );
          return;
      }
      if (this.#isTypeahead(e)) {
        e.preventDefault();
        this.open = true;
        void this.updateComplete.then(() => this.#typeaheadTo(e.key));
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveTo(index + 1);
        return;
      case 'ArrowUp':
        e.preventDefault();
        if (e.altKey) {
          if (this.#active) this.#choose(this.#active);
          else this.open = false;
        } else {
          moveTo(index === -1 ? 0 : index - 1);
        }
        return;
      case 'Home':
        e.preventDefault();
        moveTo(0);
        return;
      case 'End':
        e.preventDefault();
        moveTo(options.length - 1);
        return;
      case 'PageDown':
        e.preventDefault();
        moveTo(index + PAGE_SIZE);
        return;
      case 'PageUp':
        e.preventDefault();
        moveTo(index - PAGE_SIZE);
        return;
      case 'Enter':
      case ' ':
        // Space while typing ahead ("New Y…") is part of the search, not a choice.
        if (e.key === ' ' && this.#typeahead) {
          e.preventDefault();
          this.#typeaheadTo(e.key);
          return;
        }
        e.preventDefault();
        if (this.#active) this.#choose(this.#active);
        else this.open = false;
        return;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation(); // close only the list, not a surrounding popup
        this.open = false;
        return;
      case 'Tab':
        if (this.#active) this.#choose(this.#active);
        else this.open = false;
        return;
    }
    if (this.#isTypeahead(e)) {
      e.preventDefault();
      this.#typeaheadTo(e.key);
    }
  }

  #isTypeahead(e: KeyboardEvent): boolean {
    return e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey;
  }

  /**
   * Highlights the next option whose label starts with the typed letters. Typing the same
   * letter repeatedly cycles through the options starting with it.
   */
  #typeaheadTo(key: string) {
    clearTimeout(this.#typeaheadTimer);
    this.#typeaheadTimer = setTimeout(() => (this.#typeahead = ''), TYPEAHEAD_RESET_MS);
    this.#typeahead += key.toLocaleLowerCase();

    const options = this.#navigable;
    const query = this.#typeahead;
    const cycling = [...query].every((c) => c === query[0]);
    const search = cycling ? (query[0] ?? '') : query;
    const start = this.#active ? options.indexOf(this.#active) : -1;
    // A fresh search (or cycling) starts after the current option; a longer one includes it.
    const offset = cycling ? 1 : 0;
    for (let i = 0; i < options.length; i++) {
      const option = options[(start + offset + i + options.length) % options.length];
      if (option?.label.toLocaleLowerCase().startsWith(search)) {
        this.#setActive(option, true);
        return;
      }
    }
  }

  #setActive(option: BareOption | null, scroll = false) {
    if (this.#active) this.#active.active = false;
    this.#active = option;
    if (option) {
      option.active = true;
      this.#trigger?.setAttribute('aria-activedescendant', option.id);
      if (scroll) option.scrollIntoView({ block: 'nearest' });
    } else {
      this.#trigger?.removeAttribute('aria-activedescendant');
    }
  }

  #choose(option: BareOption) {
    const changed = option.optionValue !== this.value;
    this.value = option.optionValue;
    this.open = false;
    if (changed) {
      this.dispatchEvent(
        new CustomEvent<BareChangeDetail>('bare-change', {
          detail: { value: this.value, option },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bare-select': BareSelect;
  }
}
