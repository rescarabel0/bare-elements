import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './index.js';
import type { BareChangeDetail } from './bare-combobox.js';
import type { BareOption } from './bare-option.js';

// Let queued microtask syncs and Lit updates settle. (rAF does not fire in background tabs.)
const settle = () => new Promise((r) => setTimeout(r, 0));

async function setup(template = defaultTemplate()) {
  const wrapper = await fixture<HTMLElement>(template);
  const el = wrapper.querySelector('bare-combobox')!;
  const input = el.querySelector('input')!;
  const listbox = el.querySelector('bare-listbox')!;
  const option = (value: string) => el.querySelector<BareOption>(`bare-option[value="${value}"]`)!;
  await el.updateComplete;
  await settle(); // let queued syncs (option upgrades) settle
  return { wrapper, el, input, listbox, option };
}

function defaultTemplate() {
  return html`<div>
    <label for="fruit">Fruit</label>
    <bare-combobox name="fruit">
      <input id="fruit" />
      <button type="button" data-clear aria-label="Clear">×</button>
      <bare-listbox>
        <bare-option value="apple">Apple</bare-option>
        <bare-option value="apricot">Apricot</bare-option>
        <bare-option value="banana" disabled>Banana</bare-option>
        <bare-option value="cherry">Cherry</bare-option>
      </bare-listbox>
    </bare-combobox>
  </div>`;
}

async function type(input: HTMLInputElement, text: string) {
  input.focus();
  await sendKeys({ type: text });
}

async function press(key: string) {
  await sendKeys({ press: key });
}

describe('bare-combobox', () => {
  describe('ARIA wiring', () => {
    it('wires the input to the listbox', async () => {
      const { input, listbox } = await setup();
      expect(input.getAttribute('role')).to.equal('combobox');
      expect(input.getAttribute('aria-autocomplete')).to.equal('list');
      expect(input.getAttribute('aria-expanded')).to.equal('false');
      expect(listbox.getAttribute('role')).to.equal('listbox');
      expect(listbox.id).to.not.be.empty;
      expect(input.getAttribute('aria-controls')).to.equal(listbox.id);
      expect(listbox.hidden).to.be.true;
    });

    it('gives every option a role, an id and aria-selected', async () => {
      const { el, option } = await setup();
      for (const o of el.querySelectorAll('bare-option')) {
        expect(o.getAttribute('role')).to.equal('option');
        expect(o.id).to.not.be.empty;
        expect(o.getAttribute('aria-selected')).to.equal('false');
      }
      expect(option('banana').getAttribute('aria-disabled')).to.equal('true');
    });

    it('is accessible closed and open', async () => {
      const { wrapper, el, input } = await setup();
      await expect(wrapper).to.be.accessible();
      await type(input, 'a');
      expect(el.open).to.be.true;
      await expect(wrapper).to.be.accessible();
    });
  });

  describe('filtering', () => {
    it('opens and filters by "contains" while typing', async () => {
      const { el, input, option } = await setup();
      await type(input, 'ap');
      await el.updateComplete;
      expect(el.open).to.be.true;
      expect(input.getAttribute('aria-expanded')).to.equal('true');
      expect(option('apple').hidden).to.be.false;
      expect(option('apricot').hidden).to.be.false;
      expect(option('cherry').hidden).to.be.true;
    });

    it('matches anywhere in the label, ignoring case', async () => {
      const { input, option } = await setup();
      await type(input, 'ERR');
      expect(option('cherry').hidden).to.be.false;
      expect(option('apple').hidden).to.be.true;
    });

    it('supports filter="starts-with"', async () => {
      const { input, option } = await setup(defaultTemplate());
      input.closest('bare-combobox')!.filter = 'starts-with';
      await type(input, 'err');
      expect(option('cherry').hidden).to.be.true;
    });

    it('never hides options with filter="none"', async () => {
      const { el, input } = await setup();
      el.filter = 'none';
      await type(input, 'zzz');
      for (const o of el.querySelectorAll('bare-option')) expect(o.hidden).to.be.false;
    });

    it('closes when nothing matches', async () => {
      const { el, input } = await setup();
      await type(input, 'zzz');
      await el.updateComplete;
      expect(el.open).to.be.false;
    });
  });

  describe('keyboard', () => {
    it('ArrowDown opens and highlights the first option', async () => {
      const { el, input, option } = await setup();
      input.focus();
      await press('ArrowDown');
      await el.updateComplete;
      expect(el.open).to.be.true;
      expect(el.activeOption).to.equal(option('apple'));
      expect(option('apple').active).to.be.true;
      expect(input.getAttribute('aria-activedescendant')).to.equal(option('apple').id);
      expect(document.activeElement).to.equal(input);
    });

    it('ArrowUp opens and highlights the last option', async () => {
      const { el, input, option } = await setup();
      input.focus();
      await press('ArrowUp');
      expect(el.activeOption).to.equal(option('cherry'));
    });

    it('skips disabled options and wraps around', async () => {
      const { el, input, option } = await setup();
      input.focus();
      await press('ArrowDown'); // apple
      await press('ArrowDown'); // apricot
      await press('ArrowDown'); // banana is disabled -> cherry
      expect(el.activeOption).to.equal(option('cherry'));
      await press('ArrowDown'); // wraps
      expect(el.activeOption).to.equal(option('apple'));
      await press('ArrowUp'); // wraps back
      expect(el.activeOption).to.equal(option('cherry'));
    });

    it('Alt+ArrowDown opens without highlighting', async () => {
      const { el, input } = await setup();
      input.focus();
      await sendKeys({ down: 'Alt' });
      await press('ArrowDown');
      await sendKeys({ up: 'Alt' });
      await el.updateComplete;
      expect(el.open).to.be.true;
      expect(el.activeOption).to.be.null;
    });

    it('Enter chooses the highlighted option', async () => {
      const { el, input, option } = await setup();
      input.focus();
      await press('ArrowDown');
      setTimeout(() => press('Enter'));
      const event = (await oneEvent(el, 'bare-change')) as CustomEvent<BareChangeDetail>;
      await el.updateComplete;
      expect(event.detail).to.deep.equal({ value: 'apple', option: option('apple') });
      expect(el.value).to.equal('apple');
      expect(input.value).to.equal('Apple');
      expect(el.open).to.be.false;
      expect(option('apple').selected).to.be.true;
      expect(option('apple').getAttribute('aria-selected')).to.equal('true');
    });

    it('reopens on the chosen option, showing the whole list', async () => {
      const { el, input, option } = await setup();
      await type(input, 'cher');
      await press('ArrowDown');
      await press('Enter');
      await press('ArrowDown');
      await el.updateComplete;
      expect(el.activeOption).to.equal(option('cherry'));
      expect(option('apple').hidden).to.be.false;
    });

    it('Escape closes, then clears the text and keeps the list closed', async () => {
      const { el, input } = await setup();
      await type(input, 'ap');
      await press('Escape');
      await el.updateComplete;
      expect(el.open).to.be.false;
      expect(input.value).to.equal('ap');
      await press('Escape');
      await el.updateComplete;
      expect(input.value).to.equal('');
      expect(el.open).to.be.false;
    });

    it('Tab closes without choosing', async () => {
      const { el, input } = await setup();
      input.focus();
      await press('ArrowDown');
      await press('Tab');
      await el.updateComplete;
      expect(el.open).to.be.false;
      expect(el.value).to.equal('');
    });
  });

  describe('pointer', () => {
    it('clicking an option chooses it and keeps focus in the input', async () => {
      const { el, input, option } = await setup();
      await type(input, 'a');
      option('apricot').click();
      await el.updateComplete;
      expect(el.value).to.equal('apricot');
      expect(input.value).to.equal('Apricot');
      expect(document.activeElement).to.equal(input);
    });

    it('ignores clicks on disabled options', async () => {
      const { el, input, option } = await setup();
      await type(input, 'b');
      option('banana').click();
      expect(el.value).to.equal('');
    });

    it('highlights on hover, and clears over disabled options and on leave', async () => {
      const { el, input, option, listbox } = await setup();
      await type(input, 'a');
      option('apple').dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      expect(el.activeOption).to.equal(option('apple'));
      option('banana').dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      expect(el.activeOption).to.be.null;
      option('apple').dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      listbox.dispatchEvent(new MouseEvent('mouseleave'));
      expect(el.activeOption).to.be.null;
    });
  });

  describe('value', () => {
    it('selects the option matching an initial value', async () => {
      const { el, input, option } = await setup(defaultTemplate());
      el.value = 'cherry';
      await el.updateComplete;
      expect(option('cherry').selected).to.be.true;
      expect(input.value).to.equal('Cherry');
    });

    it('clears the selection when the text is edited', async () => {
      const { el, input } = await setup();
      el.value = 'apple';
      await el.updateComplete;
      input.focus();
      setTimeout(() => press('Backspace'));
      const event = (await oneEvent(el, 'bare-change')) as CustomEvent<BareChangeDetail>;
      expect(event.detail).to.deep.equal({ value: '', option: null });
      expect(input.value).to.equal('Appl');
    });

    // Regression: a DOM change inside the combobox during typing (here, a status message
    // written by the app) used to trigger a sync that wrote the chosen label back into the input.
    it('does not overwrite the text when the DOM changes while editing', async () => {
      const { wrapper, el, input } = await setup();
      const status = document.createElement('div');
      el.append(status);
      input.addEventListener('input', () => (status.textContent = 'Searching…'));
      wrapper.querySelector('bare-combobox')!.value = 'apple';
      await el.updateComplete;
      input.focus();
      await press('Backspace');
      await press('Backspace');
      await settle();
      expect(input.value).to.equal('App');
      expect(el.value).to.equal('');
    });
  });

  describe('clear button', () => {
    it('reflects [filled] while the input has text', async () => {
      const { el, input } = await setup();
      expect(el.hasAttribute('filled')).to.be.false;
      await type(input, 'a');
      await el.updateComplete;
      expect(el.hasAttribute('filled')).to.be.true;
    });

    it('is [filled] when a value is set programmatically', async () => {
      const { el } = await setup();
      el.value = 'apple';
      await el.updateComplete;
      await el.updateComplete;
      expect(el.hasAttribute('filled')).to.be.true;
    });

    it('clears text and value, closes, refocuses the input and notifies', async () => {
      const { el, input } = await setup();
      const button = el.querySelector<HTMLButtonElement>('[data-clear]')!;
      await type(input, 'ch');
      await press('ArrowDown');
      await press('Enter');
      await el.updateComplete;
      expect(el.value).to.equal('cherry');

      const inputEvents: string[] = [];
      input.addEventListener('input', () => inputEvents.push(input.value));
      setTimeout(() => button.click());
      const event = (await oneEvent(el, 'bare-change')) as CustomEvent<BareChangeDetail>;
      await el.updateComplete;

      expect(event.detail).to.deep.equal({ value: '', option: null });
      expect(el.value).to.equal('');
      expect(input.value).to.equal('');
      expect(el.open).to.be.false;
      expect(el.hasAttribute('filled')).to.be.false;
      expect(document.activeElement).to.equal(input);
      expect(inputEvents).to.deep.equal(['']);
    });

    it('never submits the surrounding form', async () => {
      const form = await fixture<HTMLFormElement>(html`<form>${defaultTemplate()}</form>`);
      await settle();
      let submitted = false;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        submitted = true;
      });
      const button = form.querySelector<HTMLButtonElement>('[data-clear]')!;
      button.type = 'submit';
      button.click();
      await settle();
      expect(submitted).to.be.false;
    });
  });

  describe('dynamic options', () => {
    it('picks up options added later and applies the value to them', async () => {
      const wrapper = await fixture<HTMLElement>(
        html`<div>
          <bare-combobox value="br">
            <input aria-label="Country" />
            <bare-listbox></bare-listbox>
          </bare-combobox>
        </div>`,
      );
      const el = wrapper.querySelector('bare-combobox')!;
      const input = el.querySelector('input')!;
      const option = document.createElement('bare-option');
      option.value = 'br';
      option.textContent = 'Brazil';
      el.querySelector('bare-listbox')!.append(option);
      await settle();
      expect(option.selected).to.be.true;
      expect(input.value).to.equal('Brazil');
    });

    it('drops the highlight when the highlighted option is removed', async () => {
      const { el, input, option } = await setup();
      input.focus();
      await press('ArrowDown');
      option('apple').remove();
      await settle();
      expect(el.activeOption).to.be.null;
      expect(input.hasAttribute('aria-activedescendant')).to.be.false;
    });
  });

  describe('loading', () => {
    it('marks the listbox aria-busy while loading', async () => {
      const { el, listbox } = await setup();
      el.loading = true;
      await el.updateComplete;
      expect(el.hasAttribute('loading')).to.be.true;
      expect(listbox.getAttribute('aria-busy')).to.equal('true');
      el.loading = false;
      await el.updateComplete;
      expect(listbox.hasAttribute('aria-busy')).to.be.false;
    });
  });

  describe('forms', () => {
    it('submits its value and resets', async () => {
      const form = await fixture<HTMLFormElement>(html`<form>${defaultTemplate()}</form>`);
      const el = form.querySelector('bare-combobox')!;
      const input = el.querySelector('input')!;
      await settle();
      expect(new FormData(form).get('fruit')).to.be.null;

      el.value = 'cherry';
      await el.updateComplete;
      expect(new FormData(form).get('fruit')).to.equal('cherry');
      expect(el.form).to.equal(form);

      form.reset();
      await el.updateComplete;
      expect(el.value).to.equal('');
      expect(input.value).to.equal('');
      expect(new FormData(form).get('fruit')).to.be.null;
    });

    it('lets Enter submit the form when nothing is highlighted', async () => {
      const form = await fixture<HTMLFormElement>(
        html`<form @submit=${(e: Event) => e.preventDefault()}>
          ${defaultTemplate()}<button>Go</button>
        </form>`,
      );
      const input = form.querySelector('input')!;
      input.focus();
      setTimeout(() => press('Enter'));
      await oneEvent(form, 'submit');
    });
  });
});
