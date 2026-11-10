import { ReactiveElement, type PropertyValues } from 'lit';
import { uniqueId } from '../internal/id.js';

/** @internal Fired by an option when its value or state changes. */
export const OPTION_UPDATE_EVENT = 'bare-option-update';

/**
 * One choice inside a `<bare-listbox>`.
 *
 * @attr value - Value submitted when this option is chosen. Defaults to its text.
 * @attr label - Text written into the input when chosen. Defaults to its text content.
 * @attr disabled - Skipped by keyboard navigation and cannot be chosen.
 * @attr selected - Reflected: this option holds the combobox value.
 * @attr active - Reflected: this option is highlighted (keyboard or pointer). Style it.
 */
export class BareOption extends ReactiveElement {
  static override properties = {
    value: { type: String },
    disabled: { type: Boolean, reflect: true },
    selected: { type: Boolean, reflect: true },
    active: { type: Boolean, reflect: true },
  };

  declare value: string;
  declare disabled: boolean;
  declare selected: boolean;
  declare active: boolean;

  constructor() {
    super();
    this.value = '';
    this.disabled = false;
    this.selected = false;
    this.active = false;
  }

  /** Text shown in the input once this option is chosen. */
  get label(): string {
    return (this.getAttribute('label') ?? this.textContent ?? '').trim();
  }

  /** Value submitted with the form: the `value` attribute, or the label. */
  get optionValue(): string {
    return this.value || this.label;
  }

  protected override createRenderRoot() {
    return this;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.setAttribute('role', 'option');
    if (!this.id) this.id = uniqueId('bare-option');
  }

  protected override updated(changed: PropertyValues<this>) {
    // Tell the owning combobox to re-read options: they may upgrade after it connected.
    if (changed.has('value') || changed.has('disabled')) {
      this.dispatchEvent(new Event(OPTION_UPDATE_EVENT, { bubbles: true }));
    }
    if (changed.has('selected')) this.setAttribute('aria-selected', String(this.selected));
    if (changed.has('disabled')) {
      if (this.disabled) this.setAttribute('aria-disabled', 'true');
      else this.removeAttribute('aria-disabled');
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bare-option': BareOption;
  }
}
