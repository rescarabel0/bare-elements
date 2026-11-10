import { BareCombobox } from './bare-combobox.js';
import { BareListbox } from './bare-listbox.js';
import { BareOption } from './bare-option.js';

// Options and listbox first, so the combobox finds upgraded children when it connects.
if (!customElements.get('bare-option')) customElements.define('bare-option', BareOption);
if (!customElements.get('bare-listbox')) customElements.define('bare-listbox', BareListbox);
if (!customElements.get('bare-combobox')) customElements.define('bare-combobox', BareCombobox);

export { BareCombobox, BareListbox, BareOption };
export type { BareChangeDetail, ComboboxFilter } from './bare-combobox.js';
