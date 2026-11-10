import '../listbox/index.js';
import { BareSelect } from './bare-select.js';

if (!customElements.get('bare-select')) customElements.define('bare-select', BareSelect);

export { BareSelect };
