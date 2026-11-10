// Options and listbox first, so the combobox finds upgraded children when it connects.
import '../listbox/index.js';
import { BareCombobox } from './bare-combobox.js';

if (!customElements.get('bare-combobox')) customElements.define('bare-combobox', BareCombobox);

export { BareCombobox };
export type { ComboboxFilter } from './bare-combobox.js';
