import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html, type TemplateResult } from 'lit';
import './index.js';
import type { BareChangeDetail } from '../listbox/events.js';
import type { BareSelect } from './bare-select.js';

/** Example styling. The element ships none: this is all plain CSS against its attributes. */
const demoStyles = html`<style>
  .demo {
    font-family: system-ui, sans-serif;
    display: grid;
    gap: 0.375rem;
    max-width: 18rem;
  }
  .demo label,
  .demo .label {
    font-size: 0.875rem;
    font-weight: 500;
  }
  .demo bare-select {
    position: relative;
    display: block;
  }
  .demo [data-trigger] {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    font: inherit;
    text-align: start;
    background: #fff;
    border: 1px solid #c4c4c8;
    border-radius: 0.375rem;
    cursor: pointer;
  }
  .demo [data-trigger]::after {
    content: '';
    width: 0.5rem;
    height: 0.5rem;
    margin-top: -0.25rem;
    border-right: 2px solid #55555c;
    border-bottom: 2px solid #55555c;
    transform: rotate(45deg);
    transition: transform 0.15s;
  }
  .demo bare-select[open] [data-trigger]::after {
    margin-top: 0.25rem;
    transform: rotate(-135deg);
  }
  .demo [data-trigger]:focus-visible {
    outline: 2px solid #3b6fd8;
    outline-offset: 1px;
  }
  .demo [data-trigger][data-placeholder] {
    color: #8a8a90;
  }
  .demo [data-trigger]:disabled {
    color: #9a9aa0;
    background: #f4f4f5;
    cursor: not-allowed;
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
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border-radius: 0.25rem;
    cursor: default;
  }
  .demo bare-option[active] {
    background: #e8eefb;
  }
  .demo bare-option[selected] {
    font-weight: 600;
  }
  .demo bare-option[selected]::after {
    content: '✓';
    margin-inline-start: auto;
    color: #3b6fd8;
  }
  .demo bare-option[disabled] {
    color: #9a9aa0;
  }
  .demo .swatch {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
  }
  .demo output {
    font-size: 0.8125rem;
    color: #55555c;
  }
</style>`;

function frame(content: TemplateResult) {
  return html`${demoStyles}
    <div class="demo">${content}</div>`;
}

function logValue(e: CustomEvent<BareChangeDetail>) {
  const output = (e.currentTarget as Element).parentElement?.querySelector('output');
  if (!output) return;
  const { value, option } = e.detail;
  output.textContent = `value: ${JSON.stringify(value)}` + (option ? ` (${option.label})` : '');
}

const meta: Meta<BareSelect> = {
  title: 'Select',
  component: 'bare-select',
};
export default meta;

type Story = StoryObj<BareSelect>;

export const Basic: Story = {
  render: () =>
    frame(html`
      <span class="label" id="size-label">Size</span>
      <bare-select value="m" @bare-change=${logValue}>
        <button type="button" data-trigger aria-labelledby="size-label"></button>
        <bare-listbox>
          <bare-option value="xs">Extra small</bare-option>
          <bare-option value="s">Small</bare-option>
          <bare-option value="m">Medium</bare-option>
          <bare-option value="l">Large</bare-option>
          <bare-option value="xl" disabled>Extra large (sold out)</bare-option>
        </bare-listbox>
      </bare-select>
      <output>value: "m"</output>
    `),
};

export const Placeholder: Story = {
  render: () =>
    frame(html`
      <span class="label" id="fruit-label">Fruit</span>
      <bare-select placeholder="Pick a fruit…" @bare-change=${logValue}>
        <button type="button" data-trigger aria-labelledby="fruit-label"></button>
        <bare-listbox>
          <bare-option value="apple">Apple</bare-option>
          <bare-option value="banana">Banana</bare-option>
          <bare-option value="blueberry">Blueberry</bare-option>
          <bare-option value="cherry">Cherry</bare-option>
        </bare-listbox>
      </bare-select>
      <output>value: ""</output>
    `),
};

/**
 * Options can hold any markup, and `[data-value]` keeps the label next to other content in the
 * trigger. Set the `label` attribute when an option's text isn't what the trigger should show.
 */
export const RichOptions: Story = {
  render: () => {
    const colors = [
      ['red', 'Red', '#d64545'],
      ['green', 'Green', '#3a9d5d'],
      ['blue', 'Blue', '#3b6fd8'],
      ['purple', 'Purple', '#8a4fd8'],
    ] as const;
    return frame(html`
      <span class="label" id="color-label">Color</span>
      <bare-select value="blue" @bare-change=${logValue}>
        <button type="button" data-trigger aria-labelledby="color-label">
          <span data-value></span>
        </button>
        <bare-listbox>
          ${colors.map(
            ([value, label, color]) => html`
              <bare-option value=${value} label=${label}>
                <span class="swatch" style="background: ${color}"></span>${label}
              </bare-option>
            `,
          )}
        </bare-listbox>
      </bare-select>
      <output>value: "blue"</output>
    `);
  },
};

/** Type to jump: "c" cycles through C countries, "ca" goes to Canada. */
export const LongListWithTypeahead: Story = {
  render: () => {
    const countries = new Intl.DisplayNames(['en'], { type: 'region' });
    const codes =
      'AR AU AT BE BO BR CA CL CN CO CR CU DK EC EG FI FR DE GR IN IE IT JP MX NL NZ NO PY PE PL PT ES SE CH GB US UY VE'.split(
        ' ',
      );
    const sorted = codes
      .map((code) => [code, countries.of(code) ?? code] as const)
      .sort((a, b) => a[1].localeCompare(b[1]));
    return frame(html`
      <span class="label" id="country-label">Country</span>
      <bare-select placeholder="Choose a country" @bare-change=${logValue}>
        <button type="button" data-trigger aria-labelledby="country-label"></button>
        <bare-listbox>
          ${sorted.map(([code, name]) => html`<bare-option value=${code}>${name}</bare-option>`)}
        </bare-listbox>
      </bare-select>
      <output>value: ""</output>
    `);
  },
};

export const Disabled: Story = {
  render: () =>
    frame(html`
      <span class="label" id="disabled-label">Plan</span>
      <bare-select value="pro" disabled>
        <button type="button" data-trigger aria-labelledby="disabled-label"></button>
        <bare-listbox>
          <bare-option value="free">Free</bare-option>
          <bare-option value="pro">Pro</bare-option>
        </bare-listbox>
      </bare-select>
    `),
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
        <span class="label" id="shipping-label">Shipping</span>
        <bare-select name="shipping" value="standard">
          <button type="button" data-trigger aria-labelledby="shipping-label"></button>
          <bare-listbox>
            <bare-option value="standard">Standard (5–7 days)</bare-option>
            <bare-option value="express">Express (2 days)</bare-option>
            <bare-option value="overnight">Overnight</bare-option>
          </bare-listbox>
        </bare-select>
        <div>
          <button type="submit">Submit</button>
          <button type="reset">Reset</button>
        </div>
        <output>Submit to see the form data</output>
      </form>
    `);
  },
};
