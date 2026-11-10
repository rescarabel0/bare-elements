import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './index.js';
import type { BareDatePicker } from './bare-date-picker.js';

async function setup(lang = 'pt-BR') {
  const wrapper = await fixture<HTMLElement>(
    html`<div lang=${lang}>
      <bare-date-picker>
        <input aria-label="Date" />
        <button type="button" data-toggle aria-label="Choose date">📅</button>
        <div data-popup aria-label="Choose date"><bare-calendar></bare-calendar></div>
      </bare-date-picker>
    </div>`,
  );
  const el = wrapper.querySelector<BareDatePicker>('bare-date-picker')!;
  const input = el.querySelector('input')!;
  await el.updateComplete;
  input.focus();
  return { el, input };
}

const caret = (input: HTMLInputElement) => input.selectionStart;

describe('date input mask', () => {
  it('inserts separators while typing digits', async () => {
    const { input } = await setup();
    await sendKeys({ type: '1' });
    expect(input.value).to.equal('1');
    await sendKeys({ type: '0' });
    expect(input.value).to.equal('10/');
    await sendKeys({ type: '112026' });
    expect(input.value).to.equal('10/11/2026');
    await sendKeys({ type: '9' });
    expect(input.value).to.equal('10/11/2026');
  });

  it('pads a field when the separator is typed early', async () => {
    const { input } = await setup();
    await sendKeys({ type: '1/2/2026' });
    expect(input.value).to.equal('01/02/2026');
  });

  it('backspace removes the separator and the digit before it', async () => {
    const { input } = await setup();
    await sendKeys({ type: '1011' });
    expect(input.value).to.equal('10/11/');
    await sendKeys({ press: 'Backspace' });
    expect(input.value).to.equal('10/1');
    // Deleting never re-adds a trailing separator, so the next Backspace eats a digit.
    await sendKeys({ press: 'Backspace' });
    expect(input.value).to.equal('10');
    await sendKeys({ press: 'Backspace' });
    expect(input.value).to.equal('1');
  });

  it('keeps the caret in place when editing the middle', async () => {
    const { input } = await setup();
    await sendKeys({ type: '10112026' });
    input.setSelectionRange(4, 4); // 10/1|1/2026
    await sendKeys({ press: 'Backspace' });
    expect(input.value).to.equal('10/12/026');
    expect(caret(input)).to.equal(2); // 10|/12/026
  });

  it('typing in the middle steps over separators', async () => {
    const { input } = await setup();
    await sendKeys({ type: '10112026' });
    input.setSelectionRange(1, 1); // 1|0/11/2026
    await sendKeys({ type: '5' });
    expect(input.value).to.equal('15/01/1202');
    expect(caret(input)).to.equal(3); // 15/|01/1202
  });

  it('backspace right after a middle separator deletes the digit before it', async () => {
    const { input } = await setup();
    await sendKeys({ type: '10112026' });
    input.setSelectionRange(3, 3); // 10/|11/2026
    await sendKeys({ press: 'Backspace' });
    expect(input.value).to.equal('11/12/026');
    expect(caret(input)).to.equal(1);
  });

  it('follows the locale order and separators', async () => {
    const { input } = await setup('de-DE');
    await sendKeys({ type: '10112026' });
    expect(input.value).to.equal('10.11.2026');
  });

  it('commits a typed date as ISO', async () => {
    const { el, input } = await setup('en-US');
    await sendKeys({ type: '11102026' });
    expect(input.value).to.equal('11/10/2026');
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(el.value).to.equal('2026-11-10');
  });
});
