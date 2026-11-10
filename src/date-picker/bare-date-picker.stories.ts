import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html, type TemplateResult } from 'lit';
import './index.js';
import { addDays, dayOfWeek, isSameMonth, startOfMonth, todayISODate } from '../internal/date.js';
import type { BareDatePicker } from './bare-date-picker.js';

/**
 * Example styling. The elements ship none: this is all plain CSS against `data-part` hooks and
 * state attributes.
 */
const demoStyles = html`<style>
  .demo {
    font-family: system-ui, sans-serif;
    display: grid;
    gap: 0.375rem;
    max-width: 18rem;
  }
  .demo label {
    font-size: 0.875rem;
    font-weight: 500;
  }

  /* Field */
  .demo bare-date-picker {
    position: relative;
    display: block;
  }
  .demo bare-date-picker input {
    box-sizing: border-box;
    width: 100%;
    padding: 0.5rem 2.5rem 0.5rem 0.75rem;
    font: inherit;
    border: 1px solid #c4c4c8;
    border-radius: 0.375rem;
  }
  .demo bare-date-picker input:focus {
    outline: 2px solid #3b6fd8;
    outline-offset: 1px;
  }
  .demo bare-date-picker[invalid] input {
    border-color: #c0392b;
  }
  .demo [data-toggle] {
    display: grid;
    place-items: center;
    color: #55555c;
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    width: 2rem;
    height: calc(100% - 0.5rem);
    padding: 0;
    font-size: 1rem;
    background: none;
    border: 0;
    border-radius: 0.25rem;
    cursor: pointer;
  }
  .demo [data-toggle]:hover {
    background: #ececef;
  }
  .demo [data-popup] {
    position: absolute;
    top: calc(100% + 0.25rem);
    left: 0;
    z-index: 1;
    padding: 0.75rem;
    background: #fff;
    border: 1px solid #c4c4c8;
    border-radius: 0.5rem;
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.08);
  }
  .demo [data-popup][hidden] {
    display: none;
  }
  .demo .error {
    font-size: 0.8125rem;
    color: #c0392b;
  }
  .demo bare-date-picker:not([invalid]) + .error {
    display: none;
  }
  .demo output {
    font-size: 0.8125rem;
    color: #55555c;
  }

  /* Calendar */
  .demo bare-calendar {
    display: block;
    width: 16rem;
  }
  .demo [data-part='header'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  /* The selects show the month; keep the title for screen readers only (it announces changes). */
  .demo [data-part='title'] {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  /* Month and year: <bare-select>s, styled like any other */
  .demo bare-calendar bare-select {
    position: relative;
  }
  .demo bare-calendar [data-trigger] {
    padding: 0.25rem 0.375rem;
    font: inherit;
    font-weight: 600;
    text-transform: capitalize;
    background: none;
    border: 1px solid transparent;
    border-radius: 0.25rem;
    cursor: pointer;
  }
  .demo bare-calendar [data-trigger]::after {
    content: ' ▾';
    font-size: 0.75em;
    color: #55555c;
  }
  .demo bare-calendar [data-trigger]:hover,
  .demo bare-calendar bare-select[open] [data-trigger] {
    border-color: #c4c4c8;
  }
  .demo bare-calendar [data-trigger]:focus-visible {
    outline: 2px solid #3b6fd8;
  }
  .demo bare-calendar bare-select bare-listbox {
    position: absolute;
    top: calc(100% + 0.25rem);
    left: 0;
    z-index: 2;
    min-width: 100%;
    max-height: 13rem;
    overflow-y: auto;
    padding: 0.25rem;
    background: #fff;
    border: 1px solid #c4c4c8;
    border-radius: 0.375rem;
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.08);
  }
  .demo bare-calendar bare-select bare-listbox[hidden] {
    display: none;
  }
  .demo bare-calendar bare-select bare-option {
    display: block;
    padding: 0.3125rem 0.625rem;
    font-size: 0.875rem;
    text-transform: capitalize;
    white-space: nowrap;
    border-radius: 0.25rem;
    cursor: default;
  }
  .demo bare-calendar bare-select bare-option[active] {
    background: #e8eefb;
  }
  .demo bare-calendar bare-select bare-option[selected] {
    font-weight: 600;
    color: #3b6fd8;
  }
  .demo bare-calendar bare-select bare-option[disabled] {
    color: #b4b4ba;
  }
  .demo [data-part='month-select'] {
    margin-inline-start: auto;
  }
  .demo [data-part='year-select'] {
    margin-inline-end: auto;
  }
  .demo [data-part='prev'],
  .demo [data-part='next'] {
    display: grid;
    place-items: center;
    color: #55555c;
    width: 2rem;
    height: 2rem;
    font-size: 1.25rem;
    background: none;
    border: 0;
    border-radius: 0.25rem;
    cursor: pointer;
  }
  .demo [data-part='prev']:hover:not(:disabled),
  .demo [data-part='next']:hover:not(:disabled) {
    background: #ececef;
  }
  .demo [data-part='prev']:disabled,
  .demo [data-part='next']:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .demo [data-part='grid'] {
    width: 100%;
    border-collapse: collapse;
  }
  .demo [data-part='weekday'] {
    padding-bottom: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #55555c;
    text-transform: capitalize;
  }
  .demo [data-part='grid'] td {
    padding: 1px;
    text-align: center;
  }
  .demo [data-part='day'] {
    width: 2.125rem;
    height: 2.125rem;
    font: inherit;
    font-size: 0.875rem;
    background: none;
    border: 0;
    border-radius: 50%;
    cursor: pointer;
  }
  .demo [data-part='day']:hover {
    background: #e8eefb;
  }
  .demo [data-part='day']:focus-visible {
    outline: 2px solid #3b6fd8;
    outline-offset: -2px;
  }
  .demo [data-part='day'][data-today] {
    font-weight: 700;
    color: #3b6fd8;
  }
  .demo [data-part='day'][data-selected] {
    color: #fff;
    background: #3b6fd8;
  }
  .demo [data-part='day'][data-unavailable] {
    color: #b4b4ba;
    text-decoration: line-through;
    cursor: default;
  }
  .demo [data-part='day'][data-unavailable]:hover {
    background: none;
  }

  /* Range: a continuous band with rounded ends */
  .demo .range [data-part='grid'] td {
    padding: 1px 0;
  }
  /* Days inside a range are [data-selected] too: override the solid selected style. */
  .demo .range [data-part='day'][data-in-range] {
    color: #1d3f8a;
    background: #e8eefb;
    border-radius: 0;
  }
  .demo .range [data-part='day'][data-range-start],
  .demo .range [data-part='day'][data-range-end] {
    color: #fff;
    background: #3b6fd8;
  }
  .demo .range [data-part='day'][data-range-start]:not([data-range-end]) {
    border-radius: 50% 0 0 50%;
  }
  .demo .range [data-part='day'][data-range-end]:not([data-range-start]) {
    border-radius: 0 50% 50% 0;
  }
  .demo .range [data-part='day'][data-preview][data-in-range] {
    background: #f1f4fc;
  }
  .demo .range [data-part='day'][data-preview][data-range-end]:not([data-range-start]) {
    color: #3b6fd8;
    background: #dbe5fa;
  }

  /* Markers: dots under the number, colored per marker key */
  .demo [data-part='day'] {
    position: relative;
  }
  .demo [data-part='markers'] {
    position: absolute;
    bottom: 3px;
    left: 50%;
    display: flex;
    gap: 2px;
    transform: translateX(-50%);
  }
  .demo [data-part='marker'] {
    width: 4px;
    height: 4px;
    border-radius: 50%;
  }
  .demo [data-marker='ok'] {
    --marker: #2f9e5b;
  }
  .demo [data-marker='failed'] {
    --marker: #d64545;
  }
  .demo [data-marker='partial'] {
    --marker: #e0a100;
  }
  .demo [data-part='marker'] {
    background: var(--marker);
  }
  .demo [data-part='day'][data-selected] [data-part='marker'] {
    background: #fff;
  }
  /* Or tint the whole cell instead of dots (later markers win: failed over ok) */
  .demo .tinted [data-part='markers'] {
    display: none;
  }
  .demo .tinted [data-part='day'][data-markers~='ok'] {
    background: #e3f4e9;
  }
  .demo .tinted [data-part='day'][data-markers~='partial'] {
    background: #fbf0cc;
  }
  .demo .tinted [data-part='day'][data-markers~='failed'] {
    background: #fbe1e1;
  }
  .demo .tinted [data-part='day'][data-selected] {
    color: #fff;
    background: #3b6fd8;
  }
  .demo .tinted [data-part='legend-item']::before {
    border-radius: 2px;
  }
  .demo [data-part='legend'] {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem 0.875rem;
    margin: 0.625rem 0 0;
    padding: 0.625rem 0 0;
    font-size: 0.75rem;
    color: #55555c;
    list-style: none;
    border-top: 1px solid #ececef;
  }
  .demo [data-part='legend-item'] {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .demo [data-part='legend-item']::before {
    content: '';
    width: 0.5rem;
    height: 0.5rem;
    background: var(--marker);
    border-radius: 50%;
  }
</style>`;

const calendarIcon = html`<svg
  width="18"
  height="18"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <rect x="3" y="4" width="18" height="18" rx="2" />
  <path d="M16 2v4M8 2v4M3 10h18" />
</svg>`;

const chevron = (direction: 'left' | 'right') =>
  html`<svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d=${direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
  </svg>`;

/** The icons are yours: any element works (SVG, icon font, <img>, Lottie, emoji…). */
const icons = html`
  <span data-prev-icon>${chevron('left')}</span>
  <span data-next-icon>${chevron('right')}</span>
`;

function frame(content: TemplateResult, lang?: string) {
  return html`${demoStyles}
    <div class="demo" lang=${lang ?? 'en-US'}>${content}</div>`;
}

function logValue(e: CustomEvent<{ value: string }>) {
  const output = (e.currentTarget as Element).parentElement?.querySelector('output');
  if (output) output.textContent = `value: ${JSON.stringify(e.detail.value)}`;
}

function picker(id: string, attrs: { value?: string; min?: string; max?: string } = {}) {
  return html`
    <bare-date-picker
      value=${attrs.value ?? ''}
      min=${attrs.min ?? ''}
      max=${attrs.max ?? ''}
      @bare-change=${logValue}
    >
      <input id=${id} />
      <button type="button" data-toggle aria-label="Choose date">${calendarIcon}</button>
      <div data-popup aria-label="Choose date">
        <bare-calendar>${icons}</bare-calendar>
      </div>
    </bare-date-picker>
  `;
}

const meta: Meta<BareDatePicker> = {
  title: 'Date picker',
  component: 'bare-date-picker',
};
export default meta;

type Story = StoryObj<BareDatePicker>;

export const Basic: Story = {
  render: () =>
    frame(html`
      <label for="due">Due date</label>
      ${picker('due')}
      <span class="error">Enter a valid date (MM/DD/YYYY).</span>
      <output>value: ""</output>
    `),
};

/** Same element with `lang="pt-BR"` on an ancestor: format, names and week start follow. */
export const BrazilianPortuguese: Story = {
  render: () =>
    frame(
      html`
        <label for="vencimento">Vencimento</label>
        <bare-date-picker value="2026-11-10" @bare-change=${logValue}>
          <input id="vencimento" />
          <button type="button" data-toggle aria-label="Escolher data">${calendarIcon}</button>
          <div data-popup aria-label="Escolher data">
            <bare-calendar
              prev-label="Mês anterior"
              next-label="Próximo mês"
              month-label="Mês"
              year-label="Ano"
              >${icons}</bare-calendar
            >
          </div>
        </bare-date-picker>
        <span class="error">Digite uma data válida (DD/MM/AAAA).</span>
        <output>value: "2026-11-10"</output>
      `,
      'pt-BR',
    ),
};

/**
 * `min` and `max` bound the calendar and typed dates; `isDateDisabled` blocks more. Here: the
 * next 60 days, weekdays only.
 */
export const Constraints: Story = {
  render: () => {
    const today = todayISODate();
    const weekdaysOnly = (date: string) => [0, 6].includes(dayOfWeek(date));
    return frame(html`
      <label for="booking">Appointment (next 60 days, weekdays)</label>
      <bare-date-picker
        min=${today}
        max=${addDays(today, 60)}
        .isDateDisabled=${weekdaysOnly}
        @bare-change=${logValue}
      >
        <input id="booking" />
        <button type="button" data-toggle aria-label="Choose date">${calendarIcon}</button>
        <div data-popup aria-label="Choose date">
          <bare-calendar>${icons}</bare-calendar>
        </div>
      </bare-date-picker>
      <span class="error">Pick a weekday in the next 60 days.</span>
      <output>value: ""</output>
    `);
  },
};

export const InAForm: Story = {
  render: () => {
    const submit = (e: SubmitEvent) => {
      e.preventDefault();
      const form = e.currentTarget as HTMLFormElement;
      const output = form.querySelector('output');
      if (output) output.textContent = JSON.stringify(Object.fromEntries(new FormData(form)));
    };
    return frame(html`
      <form class="demo" @submit=${submit}>
        <label for="birthday">Birthday (required)</label>
        <bare-date-picker name="birthday" required max=${todayISODate()}>
          <input id="birthday" />
          <button type="button" data-toggle aria-label="Choose date">${calendarIcon}</button>
          <div data-popup aria-label="Choose date">
            <bare-calendar>${icons}</bare-calendar>
          </div>
        </bare-date-picker>
        <span class="error">Enter a valid date (MM/DD/YYYY).</span>
        <div>
          <button type="submit">Submit</button>
          <button type="reset">Reset</button>
        </div>
        <output>Submit to see the form data</output>
      </form>
    `);
  },
};

/** Anything can be an icon, even emoji. */
export const EmojiIcons: Story = {
  render: () =>
    frame(html`
      <label for="emoji">Party date</label>
      <bare-date-picker @bare-change=${logValue}>
        <input id="emoji" />
        <button type="button" data-toggle aria-label="Choose date">🎉</button>
        <div data-popup aria-label="Choose date">
          <bare-calendar>
            <span data-prev-icon>👈</span>
            <span data-next-icon>👉</span>
          </bare-calendar>
        </div>
      </bare-date-picker>
      <output>value: ""</output>
    `),
};

function sampleMarkers() {
  // Fake daily job runs on the weekdays of the current month, so they're always on screen:
  // most succeed, some fail, a few have partial data, and one day both succeeded and failed.
  const first = startOfMonth(todayISODate());
  const ok: string[] = [];
  const failed: string[] = [];
  const partial: string[] = [];
  for (let day = first; isSameMonth(day, first); day = addDays(day, 1)) {
    if ([0, 6].includes(dayOfWeek(day))) continue;
    const n = Number(day.slice(8));
    if (n % 6 === 3) failed.push(day);
    else if (n % 5 === 4) partial.push(day);
    else ok.push(day);
  }
  if (ok[1]) failed.push(ok[1]); // a day can have several markers
  return {
    ok: { label: 'Has data', dates: ok },
    failed: { label: 'Failed', dates: failed },
    partial: { label: 'Partial data', dates: partial },
  };
}

/**
 * `markers` groups dates by meaning. Each marked day gets hooks for dots (or a tinted cell),
 * the labels join its accessible name ("…, Has data, Failed"), and a legend is rendered.
 */
export const Markers: Story = {
  render: () =>
    frame(html`
      <bare-calendar .markers=${sampleMarkers()} @bare-change=${logValue}>${icons}</bare-calendar>
      <output>value: ""</output>
    `),
};

/** Same markers, styled as tinted cells instead of dots: only the CSS differs. */
export const MarkersTinted: Story = {
  render: () =>
    frame(html`
      <div class="tinted">
        <bare-calendar .markers=${sampleMarkers()}>${icons}</bare-calendar>
      </div>
    `),
};

/** The date picker passes `markers` through to its calendar. */
export const PickerWithMarkers: Story = {
  render: () =>
    frame(html`
      <label for="run">Run date</label>
      <bare-date-picker .markers=${sampleMarkers()} @bare-change=${logValue}>
        <input id="run" />
        <button type="button" data-toggle aria-label="Choose date">${calendarIcon}</button>
        <div data-popup aria-label="Choose date">
          <bare-calendar>${icons}</bare-calendar>
        </div>
      </bare-date-picker>
      <output>value: ""</output>
    `),
};

function logRange(e: CustomEvent<{ start: string; end: string }>) {
  const output = (e.currentTarget as Element).closest('.demo')?.querySelector('output');
  if (output) output.textContent = `start: "${e.detail.start}", end: "${e.detail.end}"`;
}

/**
 * `selection="range"`: pick the start, hover or move with the arrows to preview, pick the end.
 * Escape cancels a range whose end isn't picked yet.
 */
export const RangeSelection: Story = {
  render: () =>
    frame(html`
      <div class="range">
        <bare-calendar selection="range" @bare-change=${logRange}>${icons}</bare-calendar>
      </div>
      <output>start: "", end: ""</output>
    `),
};

/** A range submits as an ISO 8601 interval: `2026-11-02/2026-11-05`. */
export const RangeInAForm: Story = {
  render: () => {
    const submit = (e: SubmitEvent) => {
      e.preventDefault();
      const form = e.currentTarget as HTMLFormElement;
      const output = form.querySelector('output');
      if (output) output.textContent = JSON.stringify(Object.fromEntries(new FormData(form)));
    };
    const today = todayISODate();
    return frame(html`
      <form class="demo range" @submit=${submit}>
        <bare-calendar
          name="period"
          selection="range"
          start=${addDays(today, 2)}
          end=${addDays(today, 6)}
          max=${addDays(today, 90)}
          >${icons}</bare-calendar
        >
        <div>
          <button type="submit">Submit</button>
          <button type="reset">Reset</button>
        </div>
        <output>Submit to see the form data</output>
      </form>
    `);
  },
};

/** The grid on its own, for inline calendars. */
export const CalendarOnly: Story = {
  render: () =>
    frame(html`
      <bare-calendar @bare-change=${logValue}>${icons}</bare-calendar>
      <output>value: ""</output>
    `),
};
