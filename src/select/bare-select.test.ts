import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './index.js';
import type { BareChangeDetail } from '../listbox/events.js';
import type { BareOption } from '../listbox/bare-option.js';
import type { BareSelect } from './bare-select.js';

const settle = () => new Promise((r) => setTimeout(r, 0));
const press = (key: string) => sendKeys({ press: key });

async function setup(value = 'banana') {
  const wrapper = await fixture<HTMLElement>(
    html`<div>
      <span id="fruit-label">Fruit</span>
      <bare-select name="fruit" value=${value}>
        <button type="button" data-trigger aria-labelledby="fruit-label"></button>
        <bare-listbox>
          <bare-option value="apple">Apple</bare-option>
          <bare-option value="apricot">Apricot</bare-option>
          <bare-option value="banana">Banana</bare-option>
          <bare-option value="blueberry" disabled>Blueberry</bare-option>
          <bare-option value="cherry">Cherry</bare-option>
        </bare-listbox>
      </bare-select>
    </div>`,
  );
  const el = wrapper.querySelector<BareSelect>('bare-select')!;
  await el.updateComplete;
  await settle();
  const trigger = el.querySelector<HTMLButtonElement>('[data-trigger]')!;
  const listbox = el.querySelector('bare-listbox')!;
  const option = (v: string) => el.querySelector<BareOption>(`bare-option[value="${v}"]`)!;
  return { wrapper, el, trigger, listbox, option };
}

describe('bare-select', () => {
  it('wires ARIA and shows the chosen label', async () => {
    const { trigger, listbox } = await setup();
    expect(trigger.getAttribute('role')).to.equal('combobox');
    expect(trigger.getAttribute('aria-haspopup')).to.equal('listbox');
    expect(trigger.getAttribute('aria-expanded')).to.equal('false');
    expect(trigger.getAttribute('aria-controls')).to.equal(listbox.id);
    expect(trigger.textContent).to.equal('Banana');
    expect(listbox.hidden).to.be.true;
  });

  it('is accessible closed and open', async () => {
    const { wrapper, el } = await setup();
    await expect(wrapper).to.be.accessible();
    el.open = true;
    await el.updateComplete;
    await expect(wrapper).to.be.accessible();
  });

  it('creates a trigger when none is given', async () => {
    const el = await fixture<BareSelect>(
      html`<bare-select value="a">
        <bare-listbox><bare-option value="a">A</bare-option></bare-listbox>
      </bare-select>`,
    );
    await settle();
    const trigger = el.querySelector('[data-trigger]')!;
    expect(trigger.tagName).to.equal('BUTTON');
    expect(trigger.textContent).to.equal('A');
  });

  it('shows the placeholder while empty', async () => {
    const { el, trigger } = await setup('');
    el.placeholder = 'Pick one';
    await el.updateComplete;
    expect(trigger.textContent).to.equal('Pick one');
    expect(trigger.hasAttribute('data-placeholder')).to.be.true;
  });

  it('opens on ArrowDown with the chosen option highlighted', async () => {
    const { el, trigger, option } = await setup();
    trigger.focus();
    await press('ArrowDown');
    await el.updateComplete;
    expect(el.open).to.be.true;
    expect(el.activeOption).to.equal(option('banana'));
    expect(trigger.getAttribute('aria-activedescendant')).to.equal(option('banana').id);
  });

  it('moves without wrapping and skips disabled options', async () => {
    const { el, trigger, option } = await setup();
    trigger.focus();
    await press('ArrowDown');
    await press('ArrowDown'); // blueberry is disabled -> cherry
    expect(el.activeOption).to.equal(option('cherry'));
    await press('ArrowDown'); // no wrap
    expect(el.activeOption).to.equal(option('cherry'));
    await press('Home');
    expect(el.activeOption).to.equal(option('apple'));
    await press('ArrowUp');
    expect(el.activeOption).to.equal(option('apple'));
  });

  it('chooses with Enter and emits bare-change', async () => {
    const { el, trigger, option } = await setup();
    trigger.focus();
    await press('ArrowDown');
    await press('ArrowDown');
    setTimeout(() => press('Enter'));
    const event = (await oneEvent(el, 'bare-change')) as CustomEvent<BareChangeDetail>;
    await el.updateComplete;
    expect(event.detail).to.deep.equal({ value: 'cherry', option: option('cherry') });
    expect(el.open).to.be.false;
    expect(trigger.textContent).to.equal('Cherry');
    expect(document.activeElement).to.equal(trigger);
  });

  it('Escape closes without choosing and does not bubble', async () => {
    const { wrapper, el, trigger } = await setup();
    let bubbled = false;
    wrapper.addEventListener('keydown', (e) => (bubbled ||= e.key === 'Escape'));
    trigger.focus();
    await press('ArrowDown');
    await press('ArrowDown');
    await press('Escape');
    await el.updateComplete;
    expect(el.open).to.be.false;
    expect(el.value).to.equal('banana');
    expect(bubbled).to.be.false;
  });

  it('Tab chooses the highlighted option', async () => {
    const { el, trigger } = await setup();
    trigger.focus();
    await press('ArrowDown');
    await press('ArrowDown');
    await press('Tab');
    await el.updateComplete;
    expect(el.value).to.equal('cherry');
    expect(el.open).to.be.false;
  });

  it('typeahead jumps to and cycles through matching options', async () => {
    const { el, trigger, option } = await setup();
    trigger.focus();
    await press('a'); // opens and jumps
    await el.updateComplete;
    await settle();
    expect(el.open).to.be.true;
    expect(el.activeOption).to.equal(option('apple'));
    await press('a');
    expect(el.activeOption).to.equal(option('apricot'));
    await new Promise((r) => setTimeout(r, 600)); // let the typeahead buffer reset
    await sendKeys({ type: 'ch' });
    expect(el.activeOption).to.equal(option('cherry'));
  });

  it('clicking toggles, choosing by click keeps focus on the trigger', async () => {
    const { el, trigger, option } = await setup();
    trigger.focus();
    trigger.click();
    await el.updateComplete;
    expect(el.open).to.be.true;
    option('apple').click();
    await el.updateComplete;
    expect(el.value).to.equal('apple');
    expect(el.open).to.be.false;
    expect(document.activeElement).to.equal(trigger);
  });

  it('disabled cannot be opened', async () => {
    const { el, trigger } = await setup();
    el.disabled = true;
    await el.updateComplete;
    expect(trigger.disabled).to.be.true;
    trigger.click();
    await el.updateComplete;
    expect(el.open).to.be.false;
  });

  it('submits its value and resets to the initial one', async () => {
    const form = await fixture<HTMLFormElement>(
      html`<form>
        <bare-select name="fruit" value="banana">
          <button type="button" data-trigger aria-label="Fruit"></button>
          <bare-listbox>
            <bare-option value="apple">Apple</bare-option>
            <bare-option value="banana">Banana</bare-option>
          </bare-listbox>
        </bare-select>
      </form>`,
    );
    const el = form.querySelector<BareSelect>('bare-select')!;
    await settle();
    expect(new FormData(form).get('fruit')).to.equal('banana');
    el.value = 'apple';
    await el.updateComplete;
    expect(new FormData(form).get('fruit')).to.equal('apple');
    form.reset();
    await el.updateComplete;
    expect(el.value).to.equal('banana');
  });
});
