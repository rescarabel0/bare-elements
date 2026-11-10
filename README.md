# bare-elements

Headless, accessible Web Components for the hard parts of UI: combobox, select, calendar and
date picker.

[![CI](https://github.com/rescarabel0/bare-elements/actions/workflows/ci.yml/badge.svg)](https://github.com/rescarabel0/bare-elements/actions/workflows/ci.yml)

**[Live demo and docs (Storybook) →](https://rescarabel0.github.io/bare-elements/)**

> **Status: early development.** The API may still change, and the package isn't on npm yet.

Most component libraries are either fully styled (and fight your design system) or tied to one
framework. `bare-elements` ships framework-agnostic custom elements that own the **behavior**
(keyboard interaction, focus management, ARIA, form participation) and leave the **look**
entirely to you.

## Elements

| Element                           | What it is                                                 | Pattern                                                                                                           |
| --------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `<bare-combobox>`                 | Editable input with a filtered list, sync or async         | [WAI-ARIA Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) (list autocomplete)                       |
| `<bare-select>`                   | A `<select>` you can actually style                        | [WAI-ARIA Select-Only Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/) |
| `<bare-calendar>`                 | Month grid: single date or range, markers with a legend    | [WAI-ARIA Date Picker grid](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/)    |
| `<bare-date-picker>`              | Text field with input mask plus a calendar popup           | [WAI-ARIA Date Picker Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/)  |
| `<bare-listbox>`, `<bare-option>` | The list and its options, shared by combobox and select    | [WAI-ARIA Listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)                                             |
| `<bare-data-table>`               | Planned: sorting, keyboard grid navigation, virtualization | [WAI-ARIA Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)                                                   |

## Principles

- **Accessible by default.** Every element follows the WAI-ARIA Authoring Practices and is tested
  in a real browser with real key presses and [axe](https://github.com/dequelabs/axe-core).
- **Headless, in the light DOM.** No shadow DOM and no shipped styles. ARIA id references
  (`aria-activedescendant`, `aria-controls`) resolve because everything is in one tree, and you
  style with plain CSS through state attributes like `[open]`, `[active]` and `[selected]`.
- **Bring your own markup.** You write the `<input>`, the buttons and the icons (SVG, an icon
  font, an image, even an emoji). The elements wire them up.
- **Forms just work.** Elements are form-associated: they submit, reset, restore and report
  validity like native controls. Dates are submitted as ISO `YYYY-MM-DD`.
- **Framework-agnostic.** Plain custom elements built with [Lit](https://lit.dev). They work in
  React, Vue, Svelte, Angular or no framework at all. No dependencies besides Lit.

## Usage

```js
import 'bare-elements'; // registers every element
```

Every example below is unstyled on purpose. The
[Storybook](https://rescarabel0.github.io/bare-elements/) shows each one with example CSS.

### Combobox

```html
<label for="country">Country</label>
<bare-combobox name="country">
  <input id="country" />
  <button type="button" data-clear aria-label="Clear">×</button>
  <bare-listbox>
    <bare-option value="br">Brazil</bare-option>
    <bare-option value="pt">Portugal</bare-option>
  </bare-listbox>
</bare-combobox>
```

```css
bare-combobox:not([filled]) [data-clear] {
  display: none;
}
bare-listbox[hidden],
bare-option[hidden] {
  display: none;
}
bare-option[active] {
  background: #e8eefb;
}
bare-option[selected] {
  font-weight: 600;
}
```

- `filter="contains" | "starts-with" | "none"`. Use `none` with server-side search: replace the
  options whenever results arrive and the combobox picks them up.
- Set `loading` while fetching. It marks the list `aria-busy` and gives you
  `bare-combobox[loading]` to show a spinner.
- Fires `bare-change` with `{ value, option }`.

### Select

```html
<span id="size-label">Size</span>
<bare-select name="size" value="m" placeholder="Pick a size">
  <button type="button" data-trigger aria-labelledby="size-label"></button>
  <bare-listbox>
    <bare-option value="s">Small</bare-option>
    <bare-option value="m">Medium</bare-option>
  </bare-listbox>
</bare-select>
```

The trigger shows the chosen label. Put a `[data-value]` element inside it to keep an icon or a
chevron next to the label. Keyboard support includes typeahead: typing "me" jumps to "Medium".

### Date picker

```html
<label for="due">Due date</label>
<bare-date-picker name="due" min="2026-01-01" required>
  <input id="due" />
  <button type="button" data-toggle aria-label="Choose date"><!-- your icon --></button>
  <div data-popup aria-label="Choose date">
    <bare-calendar></bare-calendar>
  </div>
</bare-date-picker>
```

- **Typing:** a locale-aware input mask inserts separators as you type (`10112026` becomes
  `10/11/2026` in pt-BR and `11/10/2026` in en-US) and parses the text back. Invalid or
  out-of-range dates set `[invalid]`, `aria-invalid` and the form validity.
- **Locale:** follows the nearest `lang` attribute, or the `locale` attribute: date format, month
  and day names, and the first day of the week.
- **Popup:** opens from the toggle or with Alt+↓. Escape closes it and returns focus. Focus
  leaving the picker closes it too.

### Calendar

```html
<bare-calendar value="2026-11-10" min="2026-01-01" max="2026-12-31"></bare-calendar>

<!-- range selection, submitted as an ISO 8601 interval: 2026-11-02/2026-11-05 -->
<bare-calendar selection="range" name="period" start="2026-11-02" end="2026-11-05"></bare-calendar>
```

```js
calendar.isDateDisabled = (date) => bookedDays.has(date);

// Named groups of days, rendered as hooks to style and listed in a legend
calendar.markers = {
  ok: { label: 'Has data', dates: ['2026-11-02', '2026-11-03'] },
  failed: { label: 'Failed', dates: ['2026-11-03'] },
};
```

Styling hooks: `[data-part="day"]` with `[data-today]`, `[data-selected]`, `[data-unavailable]`,
`[data-markers~="failed"]`, and in range mode `[data-range-start]`, `[data-range-end]`,
`[data-in-range]` and `[data-preview]`. Days inside a range are also `[data-selected]` (that's what
screen readers hear), so style `[data-in-range]` after any solid selected style. Marker labels are
added to each day's accessible name, so the meaning never depends on color alone.

Custom arrow icons go inside the calendar with `data-prev-icon` and `data-next-icon`. The month
and year pickers are `<bare-select>`s, styled like any other.

## Browser support

Current evergreen browsers (Chrome, Edge, Firefox, Safari). The elements rely on custom elements,
`ElementInternals` for form association, and `Intl`.

## Development

Requires Node 22+ and pnpm.

```sh
pnpm install
pnpm storybook   # docs and playground at http://localhost:6006
pnpm test        # browser tests (Web Test Runner + Chrome, real key presses)
pnpm lint
pnpm typecheck
pnpm build
```

CI runs formatting, lint, typecheck, tests and both builds on every push and pull request, and
deploys the Storybook to GitHub Pages from `main`.

## License

[MIT](./LICENSE)
