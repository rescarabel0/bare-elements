import { BareCalendar } from './bare-calendar.js';
import { BareDatePicker } from './bare-date-picker.js';

if (!customElements.get('bare-calendar')) customElements.define('bare-calendar', BareCalendar);
if (!customElements.get('bare-date-picker')) {
  customElements.define('bare-date-picker', BareDatePicker);
}

export { BareCalendar, BareDatePicker };
export type {
  BareCalendarChangeDetail,
  CalendarMarker,
  CalendarMarkers,
  CalendarSelection,
} from './bare-calendar.js';
export type { BareDatePickerChangeDetail, DatePickerSelection } from './bare-date-picker.js';
