import type { BareOption } from './bare-option.js';

/** Detail of `bare-change` from `<bare-combobox>` and `<bare-select>`. */
export interface BareChangeDetail {
  /** The new value, or `''` when the selection was cleared. */
  value: string;
  /** The chosen option, or `null` when the selection was cleared. */
  option: BareOption | null;
}

declare global {
  interface HTMLElementEventMap {
    'bare-change': CustomEvent<BareChangeDetail>;
  }
}
