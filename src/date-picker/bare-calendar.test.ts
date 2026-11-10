import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './index.js';
import type { BareCalendar, BareCalendarChangeDetail } from './bare-calendar.js';
import type { BareOption } from '../listbox/bare-option.js';
import type { BareSelect } from '../select/bare-select.js';

const settle = () => new Promise((r) => setTimeout(r, 0));

async function setup(
  template = html`<bare-calendar value="2026-01-31" locale="en-US"></bare-calendar>`,
) {
  const el = await fixture<BareCalendar>(template);
  await el.updateComplete;
  const monthSelect = el.querySelector<BareSelect>('[data-part="month-select"]')!;
  const yearSelect = el.querySelector<BareSelect>('[data-part="year-select"]')!;
  const title = () => el.querySelector('[data-part="title"]')!.textContent!.trim();
  return { el, monthSelect, yearSelect, title };
}

/** Choose an option the way a user does: open the list and click it. */
async function pick(select: BareSelect, value: string) {
  select.querySelector<HTMLElement>('[data-trigger]')!.click();
  await select.updateComplete;
  select.querySelector<HTMLElement>(`bare-option[value="${value}"]`)!.click();
}

const optionValues = (select: BareSelect, filter: (o: BareOption) => boolean = () => true) =>
  [...select.querySelectorAll('bare-option')].filter(filter).map((o) => o.optionValue);

describe('bare-calendar month and year selects', () => {
  it('show the current month and year', async () => {
    const { monthSelect, yearSelect, title } = await setup();
    expect(monthSelect.value).to.equal('1');
    expect(yearSelect.value).to.equal('2026');
    expect(title()).to.equal('January 2026');
  });

  it('jump to a month, clamping the day', async () => {
    const { el, monthSelect, title } = await setup();
    await pick(monthSelect, '2');
    await el.updateComplete;
    expect(title()).to.equal('February 2026');
    expect(el.focusedDate).to.equal('2026-02-28');
  });

  it('jump to a year', async () => {
    const { el, yearSelect, monthSelect, title } = await setup();
    await pick(yearSelect, '1990');
    await el.updateComplete;
    expect(title()).to.equal('January 1990');
    expect(monthSelect.value).to.equal('1');
  });

  it('do not leak their bare-change as a date choice', async () => {
    const { el, monthSelect } = await setup();
    let leaked = false;
    el.addEventListener('bare-change', () => (leaked = true));
    await pick(monthSelect, '5');
    expect(leaked).to.be.false;
  });

  it('stay in sync after arrow navigation following a manual pick', async () => {
    const { el, monthSelect } = await setup();
    await pick(monthSelect, '3');
    await el.updateComplete;
    el.querySelector<HTMLButtonElement>('[data-part="next"]')!.click();
    await el.updateComplete;
    expect(monthSelect.value).to.equal('4');
  });

  it('respect min and max', async () => {
    const { el, monthSelect, yearSelect } = await setup(
      html`<bare-calendar
        locale="en-US"
        value="2026-06-15"
        min="2026-03-10"
        max="2027-02-01"
      ></bare-calendar>`,
    );
    await settle();
    expect(optionValues(yearSelect)).to.deep.equal(['2026', '2027']);
    expect(optionValues(monthSelect, (o) => o.disabled)).to.deep.equal(['1', '2']);
    await pick(yearSelect, '2027');
    await el.updateComplete;
    expect(el.focusedDate).to.equal('2027-02-01'); // June 2027 clamped to max
  });
});

describe('bare-calendar arrow icons', () => {
  it('default to ‹ and ›', async () => {
    const el = await fixture<BareCalendar>(html`<bare-calendar></bare-calendar>`);
    expect(el.querySelector('[data-part="prev"]')!.textContent!.trim()).to.equal('‹');
    expect(el.querySelector('[data-part="next"]')!.textContent!.trim()).to.equal('›');
  });

  it('use the author-provided icons inside the buttons', async () => {
    const el = await fixture<BareCalendar>(
      html`<bare-calendar>
        <svg data-prev-icon aria-hidden="true"></svg>
        <span data-next-icon>👉</span>
      </bare-calendar>`,
    );
    await el.updateComplete;
    const prev = el.querySelector('[data-part="prev"]')!;
    const next = el.querySelector('[data-part="next"]')!;
    expect(prev.querySelector('svg[data-prev-icon]')).to.exist;
    expect(next.textContent!.trim()).to.equal('👉');
    expect(
      el.querySelectorAll(':scope > [data-prev-icon], :scope > [data-next-icon]'),
    ).to.have.length(0);
    // survives re-renders (month navigation)
    (prev as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.querySelector('[data-part="prev"] svg[data-prev-icon]')).to.exist;
  });

  it('picks up icons added after connecting', async () => {
    const el = await fixture<BareCalendar>(html`<bare-calendar></bare-calendar>`);
    const icon = document.createElement('span');
    icon.dataset['nextIcon'] = '';
    icon.textContent = '→';
    el.append(icon);
    await settle();
    await el.updateComplete;
    expect(el.querySelector('[data-part="next"]')!.textContent!.trim()).to.equal('→');
  });
});

describe('bare-calendar markers', () => {
  const markers = {
    ok: { label: 'Has data', dates: ['2026-11-02', '2026-11-03'] },
    failed: { label: 'Failed', dates: ['2026-11-03'] },
  };

  async function marked(extra = '') {
    const el = await fixture<BareCalendar>(
      extra === 'hide'
        ? html`<bare-calendar
            locale="en-US"
            value="2026-11-10"
            hide-legend
            .markers=${markers}
          ></bare-calendar>`
        : html`<bare-calendar
            locale="en-US"
            value="2026-11-10"
            .markers=${markers}
          ></bare-calendar>`,
    );
    await el.updateComplete;
    const day = (d: string) =>
      el.querySelector<HTMLElement>(`[data-part="day"][data-date="${d}"]`)!;
    return { el, day };
  }

  it('tags marked days with their keys and one dot per marker', async () => {
    const { day } = await marked();
    expect(day('2026-11-02').dataset['markers']).to.equal('ok');
    expect(day('2026-11-03').dataset['markers']).to.equal('ok failed');
    const dots = [...day('2026-11-03').querySelectorAll('[data-part="marker"]')].map(
      (d) => (d as HTMLElement).dataset['marker'],
    );
    expect(dots).to.deep.equal(['ok', 'failed']);
    expect(day('2026-11-04').hasAttribute('data-markers')).to.be.false;
  });

  it('adds the marker labels to the accessible name', async () => {
    const { day } = await marked();
    expect(day('2026-11-03').getAttribute('aria-label')).to.equal(
      'Tuesday, November 3, 2026, Has data, Failed',
    );
  });

  it('renders a legend, or not with hide-legend', async () => {
    const { el } = await marked();
    const items = [...el.querySelectorAll('[data-part="legend-item"]')].map((li) => [
      (li as HTMLElement).dataset['marker'],
      li.textContent!.trim(),
    ]);
    expect(items).to.deep.equal([
      ['ok', 'Has data'],
      ['failed', 'Failed'],
    ]);
    const hidden = await marked('hide');
    expect(hidden.el.querySelector('[data-part="legend"]')).to.be.null;
  });

  it('is accessible with markers and legend', async () => {
    const { el } = await marked();
    await expect(el).to.be.accessible();
  });

  it('updates when markers are replaced', async () => {
    const { el, day } = await marked();
    el.markers = { ok: { label: 'Has data', dates: ['2026-11-20'] } };
    await el.updateComplete;
    expect(day('2026-11-02').hasAttribute('data-markers')).to.be.false;
    expect(day('2026-11-20').dataset['markers']).to.equal('ok');
  });
});

describe('bare-calendar range selection', () => {
  async function rangeFixture(start = '', end = '') {
    const el = await fixture<BareCalendar>(
      html`<bare-calendar
        locale="en-US"
        selection="range"
        name="period"
        start=${start}
        end=${end}
      ></bare-calendar>`,
    );
    await el.updateComplete;
    const day = (d: string) =>
      el.querySelector<HTMLButtonElement>(`[data-part="day"][data-date="${d}"]`)!;
    const has = (d: string, attr: string) => day(d).hasAttribute(attr);
    return { el, day, has };
  }

  it('draws an initial range and opens on its start', async () => {
    const { el, has } = await rangeFixture('2026-11-03', '2026-11-06');
    expect(el.focusedDate).to.equal('2026-11-03');
    expect(has('2026-11-03', 'data-range-start')).to.be.true;
    expect(has('2026-11-04', 'data-in-range')).to.be.true;
    expect(has('2026-11-06', 'data-range-end')).to.be.true;
    expect(has('2026-11-06', 'data-in-range')).to.be.false;
    expect(has('2026-11-07', 'data-in-range')).to.be.false;
    expect(el.querySelector('[data-part="grid"]')!.getAttribute('aria-multiselectable')).to.equal(
      'true',
    );
    const selected = [...el.querySelectorAll('td[aria-selected="true"] [data-part="day"]')].map(
      (b) => (b as HTMLElement).dataset['date'],
    );
    expect(selected).to.deep.equal(['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
  });

  it('first click starts, hover previews, second click completes', async () => {
    const { el, day, has } = await rangeFixture('2026-11-03', '2026-11-06');
    day('2026-11-10').click();
    await el.updateComplete;
    expect(el.start).to.equal('2026-11-10');
    expect(el.end).to.equal('');
    expect(has('2026-11-04', 'data-in-range')).to.be.false; // old range gone

    day('2026-11-13').dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(has('2026-11-12', 'data-preview')).to.be.true;
    expect(has('2026-11-12', 'data-in-range')).to.be.true;
    expect(has('2026-11-13', 'data-range-end')).to.be.true;

    setTimeout(() => day('2026-11-13').click());
    const event = (await oneEvent(el, 'bare-change')) as CustomEvent<BareCalendarChangeDetail>;
    expect(event.detail).to.deep.equal({ value: '', start: '2026-11-10', end: '2026-11-13' });
    await el.updateComplete;
    expect(has('2026-11-12', 'data-preview')).to.be.false;
  });

  it('swaps the ends when the second pick comes first', async () => {
    const { el, day } = await rangeFixture();
    el.focusedDate = '2026-11-01';
    await el.updateComplete;
    day('2026-11-20').click();
    await el.updateComplete;
    day('2026-11-05').click();
    expect([el.start, el.end]).to.deep.equal(['2026-11-05', '2026-11-20']);
  });

  it('previews with the keyboard and Escape cancels a pending range', async () => {
    const { el, has } = await rangeFixture('2026-11-03', '2026-11-04');
    el.focusedDate = '2026-11-10';
    await el.updateComplete;
    el.focus();
    await sendKeys({ press: 'Enter' }); // start at 11-10
    await sendKeys({ press: 'ArrowDown' });
    await el.updateComplete;
    expect(has('2026-11-17', 'data-range-end')).to.be.true;
    expect(has('2026-11-12', 'data-preview')).to.be.true;

    await sendKeys({ press: 'Escape' });
    await el.updateComplete;
    expect([el.start, el.end]).to.deep.equal(['2026-11-03', '2026-11-04']);
  });

  it('ignores unavailable days as range ends', async () => {
    const { el, day } = await rangeFixture();
    el.focusedDate = '2026-11-01';
    el.isDateDisabled = (d) => d === '2026-11-08';
    await el.updateComplete;
    day('2026-11-02').click();
    await el.updateComplete;
    day('2026-11-08').click();
    expect(el.end).to.equal('');
  });

  it('submits an ISO 8601 interval and resets', async () => {
    const form = await fixture<HTMLFormElement>(
      html`<form>
        <bare-calendar
          locale="en-US"
          selection="range"
          name="period"
          start="2026-11-02"
          end="2026-11-05"
        ></bare-calendar>
      </form>`,
    );
    const el = form.querySelector<BareCalendar>('bare-calendar')!;
    await el.updateComplete;
    expect(new FormData(form).get('period')).to.equal('2026-11-02/2026-11-05');

    el.querySelector<HTMLButtonElement>('[data-date="2026-11-10"]')!.click();
    await el.updateComplete;
    expect(new FormData(form).get('period')).to.be.null; // pending: no end yet

    form.reset();
    await el.updateComplete;
    expect([el.start, el.end]).to.deep.equal(['2026-11-02', '2026-11-05']);
    expect(new FormData(form).get('period')).to.equal('2026-11-02/2026-11-05');
  });

  it('single mode still submits one date', async () => {
    const form = await fixture<HTMLFormElement>(
      html`<form>
        <bare-calendar locale="en-US" name="day" value="2026-11-02"></bare-calendar>
      </form>`,
    );
    await form.querySelector<BareCalendar>('bare-calendar')!.updateComplete;
    expect(new FormData(form).getAll('day')).to.deep.equal(['2026-11-02']);
  });
});
