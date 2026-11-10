import { expect } from '@open-wc/testing';
import { uniqueId } from './id.js';

describe('uniqueId', () => {
  it('never repeats', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uniqueId()));
    expect(ids.size).to.equal(1000);
  });

  it('uses the given prefix', () => {
    expect(uniqueId('listbox')).to.match(/^listbox-/);
  });
});
