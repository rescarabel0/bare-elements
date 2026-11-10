import { uniqueId } from '../internal/id.js';

/**
 * The popup list of a `<bare-combobox>`. Holds `<bare-option>` children.
 *
 * Shown and hidden by the combobox through the `hidden` attribute. Position and style it with
 * plain CSS; `bare-combobox[open] bare-listbox` matches it while open.
 */
export class BareListbox extends HTMLElement {
  connectedCallback() {
    this.setAttribute('role', 'listbox');
    if (!this.id) this.id = uniqueId('bare-listbox');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bare-listbox': BareListbox;
  }
}
