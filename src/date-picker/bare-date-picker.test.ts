import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys, sendMouse } from '@web/test-runner-commands';
import './index.js';
import type { BareCalendar } from './bare-calendar.js';
import type { BareDatePicker } from './bare-date-picker.js';

const settle = () => new Promise((r) => setTimeout(r, 0));
const press = (key: string) => sendKeys({ press: key });
const frames = () => new Promise((r) => setTimeout(r, 50));

/** A real pointer click (focus moves like it does for users), then let rendering settle. */
async function realClick(element: Element) {
  const { x, y, width, height } = element.getBoundingClientRect();
  await sendMouse({
    type: 'click',
    position: [Math.round(x + width / 2), Math.round(y + height / 2)],
  });
  await frames();
}

async function setup(
  attrs: { value?: string; min?: string; max?: string; required?: boolean } = {},
) {
  const wrapper = await fixture<HTMLElement>(
    html`<div lang="en-US">
      <label for="due">Due</label>
      <bare-date-picker
        name="due"
        value=${attrs.value ?? ''}
        min=${attrs.min ?? ''}
        max=${attrs.max ?? ''}
        ?required=${attrs.required ?? false}
      >
        <input id="due" />
        <button type="button" data-toggle aria-label="Choose date">📅</button>
        <div data-popup aria-label="Choose date"><bare-calendar></bare-calendar></div>
      </bare-date-picker>
      <button id="outside">Outside</button>
    </div>`,
  );
  const el = wrapper.querySelector<BareDatePicker>('bare-date-picker')!;
  await el.updateComplete;
  await settle();
  const input = el.querySelector('input')!;
  const toggle = el.querySelector<HTMLButtonElement>('[data-toggle]')!;
  const popup = el.querySelector<HTMLElement>('[data-popup]')!;
  const calendar = el.querySelector<BareCalendar>('bare-calendar')!;
  const day = (iso: string) =>
    calendar.querySelector<HTMLButtonElement>(`[data-part="day"][data-date="${iso}"]`)!;
  const arrow = (part: 'prev' | 'next') =>
    calendar.querySelector<HTMLButtonElement>(`[data-part="${part}"]`)!;
  return { wrapper, el, input, toggle, popup, calendar, day, arrow };
}

async function openWithToggle(ctx: Awaited<ReturnType<typeof setup>>) {
  ctx.toggle.focus();
  ctx.toggle.click();
  await ctx.el.updateComplete;
  await ctx.calendar.updateComplete;
  await settle();
}

describe('bare-date-picker', () => {
  describe('ARIA wiring', () => {
    it('wires the toggle to the popup dialog', async () => {
      const { toggle, popup, input } = await setup();
      expect(popup.getAttribute('role')).to.equal('dialog');
      expect(popup.hidden).to.be.true;
      expect(toggle.getAttribute('aria-haspopup')).to.equal('dialog');
      expect(toggle.getAttribute('aria-controls')).to.equal(popup.id);
      expect(toggle.getAttribute('aria-expanded')).to.equal('false');
      expect(input.placeholder).to.equal('MM/DD/YYYY');
      expect(input.inputMode).to.equal('numeric');
    });

    it('is accessible closed and open', async () => {
      const ctx = await setup({ value: '2026-11-10' });
      await expect(ctx.wrapper).to.be.accessible();
      await openWithToggle(ctx);
      await expect(ctx.wrapper).to.be.accessible();
    });
  });

  describe('popup', () => {
    it('opens on the chosen date and focuses it', async () => {
      const ctx = await setup({ value: '2026-11-10' });
      await openWithToggle(ctx);
      expect(ctx.el.open).to.be.true;
      expect(ctx.popup.hidden).to.be.false;
      expect(ctx.toggle.getAttribute('aria-expanded')).to.equal('true');
      expect(document.activeElement).to.equal(ctx.day('2026-11-10'));
    });

    it('Alt+ArrowDown in the input opens it', async () => {
      const { el, input } = await setup();
      input.focus();
      await sendKeys({ down: 'Alt' });
      await press('ArrowDown');
      await sendKeys({ up: 'Alt' });
      await el.updateComplete;
      expect(el.open).to.be.true;
    });

    it('choosing a day sets the value, fills the input, closes and refocuses the input', async () => {
      const ctx = await setup({ value: '2026-11-10' });
      await openWithToggle(ctx);
      setTimeout(() => ctx.day('2026-11-20').click());
      const event = (await oneEvent(ctx.el, 'bare-change')) as CustomEvent<{ value: string }>;
      await ctx.el.updateComplete;
      expect(event.detail.value).to.equal('2026-11-20');
      expect(ctx.el.value).to.equal('2026-11-20');
      expect(ctx.input.value).to.equal('11/20/2026');
      expect(ctx.el.open).to.be.false;
      expect(document.activeElement).to.equal(ctx.input);
    });

    it('Escape closes and returns focus to the toggle', async () => {
      const ctx = await setup();
      await openWithToggle(ctx);
      await press('Escape');
      await ctx.el.updateComplete;
      expect(ctx.el.open).to.be.false;
      expect(document.activeElement).to.equal(ctx.toggle);
    });

    it('closes when focus leaves the picker', async () => {
      const ctx = await setup();
      await openWithToggle(ctx);
      ctx.wrapper.querySelector<HTMLButtonElement>('#outside')!.focus();
      await ctx.el.updateComplete;
      expect(ctx.el.open).to.be.false;
    });

    // Regression: at max the "next" arrow becomes disabled, which drops focus to <body>; the
    // picker read that as focus leaving and closed.
    it('stays open when an arrow becomes disabled at min or max', async () => {
      const ctx = await setup({ value: '2026-11-10', min: '2026-10-01', max: '2026-12-31' });
      await openWithToggle(ctx);

      await realClick(ctx.arrow('next')); // December: next is now disabled
      expect(ctx.arrow('next').disabled).to.be.true;
      expect(ctx.el.open).to.be.true;
      expect(ctx.el.contains(document.activeElement)).to.be.true;

      await realClick(ctx.arrow('prev')); // November
      await realClick(ctx.arrow('prev')); // October: prev is now disabled
      expect(ctx.arrow('prev').disabled).to.be.true;
      expect(ctx.el.open).to.be.true;
      expect(ctx.el.contains(document.activeElement)).to.be.true;
    });
  });

  describe('typing', () => {
    it('commits a valid date on Enter', async () => {
      const { el, input } = await setup();
      input.focus();
      await sendKeys({ type: '02142027' });
      setTimeout(() => press('Enter'));
      const event = (await oneEvent(el, 'bare-change')) as CustomEvent<{ value: string }>;
      expect(event.detail.value).to.equal('2027-02-14');
      expect(el.invalid).to.be.false;
    });

    it('marks impossible dates invalid', async () => {
      const { el, input } = await setup();
      input.focus();
      await sendKeys({ type: '02302026' });
      await press('Enter');
      await el.updateComplete;
      expect(el.invalid).to.be.true;
      expect(el.hasAttribute('invalid')).to.be.true;
      expect(input.getAttribute('aria-invalid')).to.equal('true');
      expect(el.validity.badInput).to.be.true;
      expect(el.value).to.equal('');
    });

    it('marks dates outside min/max invalid', async () => {
      const { el, input } = await setup({ min: '2026-01-01', max: '2026-12-31' });
      input.focus();
      await sendKeys({ type: '01012030' });
      await press('Enter');
      await el.updateComplete;
      expect(el.invalid).to.be.true;
    });

    it('clears invalid once fixed', async () => {
      const { el, input } = await setup();
      input.focus();
      await sendKeys({ type: '02302026' });
      await press('Enter');
      input.select();
      await sendKeys({ type: '02282026' });
      await press('Enter');
      await el.updateComplete;
      expect(el.invalid).to.be.false;
      expect(el.value).to.equal('2026-02-28');
      expect(input.hasAttribute('aria-invalid')).to.be.false;
    });

    it('opens the calendar on the typed date', async () => {
      const ctx = await setup();
      ctx.input.focus();
      await sendKeys({ type: '07041990' });
      await openWithToggle(ctx);
      expect(document.activeElement).to.equal(ctx.day('1990-07-04'));
    });
  });

  describe('forms', () => {
    it('submits ISO, validates required and resets', async () => {
      const form = await fixture<HTMLFormElement>(
        html`<form lang="en-US">
          <bare-date-picker name="due" required>
            <input aria-label="Due" />
            <button type="button" data-toggle aria-label="Choose date">📅</button>
            <div data-popup aria-label="Choose date"><bare-calendar></bare-calendar></div>
          </bare-date-picker>
        </form>`,
      );
      const el = form.querySelector<BareDatePicker>('bare-date-picker')!;
      await el.updateComplete;
      await settle();
      expect(form.checkValidity()).to.be.false;
      expect(el.validity.valueMissing).to.be.true;

      el.value = '2026-11-10';
      await el.updateComplete;
      expect(form.checkValidity()).to.be.true;
      expect(new FormData(form).get('due')).to.equal('2026-11-10');
      expect(el.querySelector('input')!.value).to.equal('11/10/2026');

      form.reset();
      await el.updateComplete;
      expect(el.value).to.equal('');
      expect(el.querySelector('input')!.value).to.equal('');
    });
  });
});

describe('bare-calendar keyboard', () => {
  async function calendarAt(value: string, extra = html``) {
    const el = await fixture<BareCalendar>(
      html`<bare-calendar locale="en-US" first-day-of-week="0" value=${value}
        >${extra}</bare-calendar
      >`,
    );
    await el.updateComplete;
    el.focus();
    await el.updateComplete;
    const focused = () => (document.activeElement as HTMLElement).dataset['date'];
    const move = async (key: string) => {
      await press(key);
      await el.updateComplete;
    };
    return { el, focused, move };
  }

  it('arrows move by day and week, across months', async () => {
    const { focused, move } = await calendarAt('2026-11-30');
    expect(focused()).to.equal('2026-11-30');
    await move('ArrowRight');
    expect(focused()).to.equal('2026-12-01');
    await move('ArrowLeft');
    await move('ArrowUp');
    expect(focused()).to.equal('2026-11-23');
    await move('ArrowDown');
    expect(focused()).to.equal('2026-11-30');
  });

  it('Home/End go to the week start and end', async () => {
    const { focused, move } = await calendarAt('2026-11-11'); // a Wednesday
    await move('Home');
    expect(focused()).to.equal('2026-11-08');
    await move('End');
    expect(focused()).to.equal('2026-11-14');
  });

  it('PageUp/PageDown move by month, with Shift by year, clamping the day', async () => {
    const { focused, move } = await calendarAt('2026-03-31');
    await move('PageUp');
    expect(focused()).to.equal('2026-02-28');
    await move('PageDown');
    expect(focused()).to.equal('2026-03-28');
    await sendKeys({ down: 'Shift' });
    await move('PageDown');
    await sendKeys({ up: 'Shift' });
    expect(focused()).to.equal('2027-03-28');
  });

  it('Enter chooses, but not unavailable dates', async () => {
    const { el, move, focused } = await calendarAt('2026-11-10');
    el.isDateDisabled = (d) => d === '2026-11-11';
    await el.updateComplete;
    await move('ArrowRight');
    expect(focused()).to.equal('2026-11-11');
    await press('Enter');
    expect(el.value).to.equal('2026-11-10');
    await move('ArrowRight');
    setTimeout(() => press('Enter'));
    await oneEvent(el, 'bare-change');
    expect(el.value).to.equal('2026-11-12');
  });

  it('keeps keyboard focus within min and max', async () => {
    const el = await fixture<BareCalendar>(
      html`<bare-calendar locale="en-US" value="2026-11-10" max="2026-11-12"></bare-calendar>`,
    );
    await el.updateComplete;
    el.focus();
    await press('ArrowDown');
    await el.updateComplete;
    expect((document.activeElement as HTMLElement).dataset['date']).to.equal('2026-11-12');
  });

  it('only the roving day is in the tab order', async () => {
    const { el } = await calendarAt('2026-11-10');
    const tabbable = el.querySelectorAll('[data-part="day"][tabindex="0"]');
    expect(tabbable).to.have.length(1);
    expect((tabbable[0] as HTMLElement).dataset['date']).to.equal('2026-11-10');
  });
});
