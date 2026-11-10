import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import './index.js';
import type { BareChangeDetail, BareCombobox } from './bare-combobox.js';

const COUNTRIES = [
  ['ar', 'Argentina'],
  ['bo', 'Bolivia'],
  ['br', 'Brazil'],
  ['ca', 'Canada'],
  ['cl', 'Chile'],
  ['co', 'Colombia'],
  ['de', 'Germany'],
  ['es', 'Spain'],
  ['fr', 'France'],
  ['it', 'Italy'],
  ['jp', 'Japan'],
  ['mx', 'Mexico'],
  ['pe', 'Peru'],
  ['pt', 'Portugal'],
  ['py', 'Paraguay'],
  ['uy', 'Uruguay'],
  ['us', 'United States'],
] as const;

/**
 * Example styling. The element ships none: this is all plain CSS against its attributes.
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
  .demo bare-combobox {
    position: relative;
    display: block;
  }
  .demo input {
    box-sizing: border-box;
    width: 100%;
    padding: 0.5rem 0.75rem;
    font: inherit;
    border: 1px solid #c4c4c8;
    border-radius: 0.375rem;
  }
  .demo input:focus {
    outline: 2px solid #3b6fd8;
    outline-offset: 1px;
  }
  .demo bare-listbox {
    position: absolute;
    inset-inline: 0;
    top: calc(100% + 0.25rem);
    z-index: 1;
    max-height: 14rem;
    overflow-y: auto;
    padding: 0.25rem;
    background: #fff;
    border: 1px solid #c4c4c8;
    border-radius: 0.375rem;
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.08);
  }
  .demo bare-listbox[hidden] {
    display: none;
  }
  .demo bare-option {
    display: block;
    padding: 0.375rem 0.5rem;
    border-radius: 0.25rem;
    cursor: default;
  }
  .demo bare-option[hidden] {
    display: none;
  }
  .demo bare-option[active] {
    background: #e8eefb;
  }
  .demo bare-option[selected] {
    font-weight: 600;
  }
  .demo bare-option[selected]::after {
    content: ' ✓';
  }
  .demo bare-option[disabled] {
    color: #9a9aa0;
  }
  .demo input {
    padding-inline-end: 2.25rem;
  }
  .demo [data-clear] {
    position: absolute;
    top: 50%;
    right: 0.375rem;
    display: grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    margin-top: -0.75rem;
    padding: 0;
    font-size: 1.125rem;
    line-height: 1;
    color: #55555c;
    background: none;
    border: 0;
    border-radius: 50%;
    cursor: pointer;
  }
  .demo [data-clear]:hover {
    background: #ececef;
  }
  .demo [data-clear]:focus-visible {
    outline: 2px solid #3b6fd8;
  }
  .demo bare-combobox:not([filled]) [data-clear] {
    display: none;
  }
  .demo output {
    font-size: 0.8125rem;
    color: #55555c;
  }
</style>`;

function logValue(e: CustomEvent<BareChangeDetail>) {
  const output = (e.currentTarget as Element).parentElement?.querySelector('output');
  if (!output) return;
  const { value, option } = e.detail;
  output.textContent = `value: ${JSON.stringify(value)}` + (option ? ` (${option.label})` : '');
}

function frame(content: TemplateResult) {
  return html`${demoStyles}
    <div class="demo">${content}</div>`;
}

const meta: Meta<BareCombobox> = {
  title: 'Combobox',
  component: 'bare-combobox',
  argTypes: {
    filter: { control: 'inline-radio', options: ['contains', 'starts-with', 'none'] },
  },
  args: { filter: 'contains' },
};
export default meta;

type Story = StoryObj<BareCombobox>;

export const Basic: Story = {
  render: ({ filter }) =>
    frame(html`
      <label for="country">Country</label>
      <bare-combobox name="country" .filter=${filter} @bare-change=${logValue}>
        <input id="country" placeholder="Start typing…" />
        <button type="button" data-clear aria-label="Clear">×</button>
        <bare-listbox>
          ${COUNTRIES.map(([value, label]) => html`<bare-option value=${value}>${label}</bare-option>`)}
        </bare-listbox>
      </bare-combobox>
      <output>value: ""</output>
    `),
};

export const InitialValue: Story = {
  render: ({ filter }) =>
    frame(html`
      <label for="country-initial">Country</label>
      <bare-combobox value="pt" .filter=${filter} @bare-change=${logValue}>
        <input id="country-initial" />
        <button type="button" data-clear aria-label="Clear">×</button>
        <bare-listbox>
          ${COUNTRIES.map(([value, label]) => html`<bare-option value=${value}>${label}</bare-option>`)}
        </bare-listbox>
      </bare-combobox>
      <output>value: "pt"</output>
    `),
};

export const DisabledOptions: Story = {
  render: ({ filter }) =>
    frame(html`
      <label for="plan">Plan</label>
      <bare-combobox .filter=${filter} @bare-change=${logValue}>
        <input id="plan" />
        <button type="button" data-clear aria-label="Clear">×</button>
        <bare-listbox>
          <bare-option value="free">Free</bare-option>
          <bare-option value="pro">Pro</bare-option>
          <bare-option value="team" disabled>Team (sold out)</bare-option>
          <bare-option value="enterprise">Enterprise</bare-option>
        </bare-listbox>
      </bare-combobox>
      <output>value: ""</output>
    `),
};

/**
 * `filter="none"` leaves filtering to you. Here a fake server answers after a delay and the
 * options are re-rendered; the combobox picks up the new children automatically.
 *
 * While the request is in flight the combobox has the `loading` attribute: the listbox is marked
 * `aria-busy`, a spinner shows in the input, stale results are dimmed, and a `role="status"`
 * message tells screen reader users what is happening.
 */
export const AsyncSearch: Story = {
  args: { filter: 'none' },
  render: () => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const search = (e: InputEvent) => {
      const input = e.currentTarget as HTMLInputElement;
      const combobox = input.closest('bare-combobox');
      const listbox = combobox?.querySelector('bare-listbox');
      const status = combobox?.querySelector<HTMLElement>('.status');
      if (!combobox || !listbox || !status) return;

      const query = input.value.trim().toLowerCase();
      clearTimeout(timer);

      if (!query) {
        combobox.loading = false;
        listbox.replaceChildren();
        status.textContent = '';
        delete status.dataset['visible'];
        return;
      }

      combobox.loading = true;
      status.textContent = 'Searching…';
      status.dataset['visible'] = '';

      timer = setTimeout(() => {
        const results = COUNTRIES.filter(([, label]) => label.toLowerCase().includes(query));
        listbox.replaceChildren(
          ...results.map(([value, label]) => {
            const option = document.createElement('bare-option');
            option.value = value;
            option.textContent = label;
            return option;
          }),
        );
        combobox.loading = false;
        status.textContent =
          results.length === 0
            ? 'No countries found'
            : `${results.length} ${results.length === 1 ? 'result' : 'results'}`;
        if (results.length > 0) delete status.dataset['visible'];
        if (results.length > 0 && document.activeElement === input) combobox.open = true;
      }, 800);
    };

    return frame(html`
      <style>
        .demo bare-combobox[loading]::after {
          content: '';
          position: absolute;
          top: 50%;
          right: 2.25rem;
          width: 0.875rem;
          height: 0.875rem;
          margin-top: -0.4375rem;
          border: 2px solid #c4c4c8;
          border-top-color: #3b6fd8;
          border-radius: 50%;
          animation: demo-spin 0.7s linear infinite;
        }
        @keyframes demo-spin {
          to {
            transform: rotate(360deg);
          }
        }
        .demo bare-combobox[loading] bare-option {
          opacity: 0.5;
        }
        /* Visible only while there is nothing better to show: no results on screen. */
        .demo .status {
          position: absolute;
          inset-inline: 0;
          top: calc(100% + 0.25rem);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: #55555c;
          background: #fff;
          border: 1px solid #c4c4c8;
          border-radius: 0.375rem;
        }
        /* Shown only for "Searching…" and "No results". Otherwise (e.g. "5 results") it is for
           screen readers only. display: none would also silence the live region, so hide it
           visually instead. */
        .demo .status:not([data-visible]),
        .demo bare-combobox[open] .status,
        .demo bare-combobox:not(:focus-within) .status {
          clip-path: inset(50%);
          width: 1px;
          height: 1px;
          padding: 0;
          border: 0;
          overflow: hidden;
          white-space: nowrap;
        }
      </style>
      <label for="async">Country (server search)</label>
      <bare-combobox
        filter="none"
        @bare-change=${(e: CustomEvent<BareChangeDetail>) => {
          logValue(e);
          // The search is over once something is chosen: drop the stale result count.
          const status = (e.currentTarget as Element).querySelector('.status');
          if (status && e.detail.option) status.textContent = '';
        }}
      >
        <input id="async" placeholder="Type to search…" @input=${search} />
        <button type="button" data-clear aria-label="Clear">×</button>
        <bare-listbox></bare-listbox>
        <div class="status" role="status"></div>
      </bare-combobox>
      <output>value: ""</output>
    `);
  },
};

export const InAForm: Story = {
  render: ({ filter }) => {
    const submit = (e: SubmitEvent) => {
      e.preventDefault();
      const form = e.currentTarget as HTMLFormElement;
      const output = form.querySelector('output');
      if (output) {
        output.textContent = JSON.stringify(Object.fromEntries(new FormData(form)));
      }
    };
    return frame(html`
      <form class="demo" @submit=${submit}>
        <label for="form-country">Country</label>
        <bare-combobox name="country" .filter=${filter}>
          <input id="form-country" />
          <button type="button" data-clear aria-label="Clear">×</button>
          <bare-listbox>
            ${repeat(
              COUNTRIES,
              ([value]) => value,
              ([value, label]) => html`<bare-option value=${value}>${label}</bare-option>`,
            )}
          </bare-listbox>
        </bare-combobox>
        <div>
          <button type="submit">Submit</button>
          <button type="reset">Reset</button>
        </div>
        <output>Submit to see the form data</output>
      </form>
    `);
  },
};
