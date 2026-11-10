# bare-elements

Headless, accessible Web Components for the hard parts of UI.

[![CI](https://github.com/rescarabel0/bare-elements/actions/workflows/ci.yml/badge.svg)](https://github.com/rescarabel0/bare-elements/actions/workflows/ci.yml)

> **Status: early development.** Nothing is published yet.

Most component libraries are either fully styled (and fight your design system) or
framework-specific. `bare-elements` ships framework-agnostic custom elements that own the
**behavior** — keyboard interaction, focus management, ARIA — and leave the **look** to you.

## Planned elements

| Element              | Pattern                                                                                                          | Status  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | ------- |
| `<bare-combobox>`    | [WAI-ARIA Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)                                          | planned |
| `<bare-date-picker>` | [WAI-ARIA Date Picker Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/) | planned |
| `<bare-data-table>`  | [WAI-ARIA Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/), sorting, virtualization                         | planned |

## Principles

- **Accessible by default.** Every element follows the WAI-ARIA Authoring Practices and is tested
  with axe in a real browser.
- **Headless.** Elements render no markup of their own and live in the light DOM, so ARIA id
  references (`aria-activedescendant`, `aria-controls`) just work and you style everything with
  plain CSS, using state attributes such as `[open]`, `[active]` and `[selected]`.
- **Framework-agnostic.** Plain custom elements, built with [Lit](https://lit.dev). Works in React,
  Vue, Svelte, Angular or no framework at all.
- **Small.** No dependencies besides Lit.

## Development

Requires Node 22+ and pnpm.

```sh
pnpm install
pnpm storybook   # docs and playground at http://localhost:6006
pnpm test        # browser tests (Web Test Runner + Chrome)
pnpm lint
pnpm typecheck
pnpm build
```

## License

[MIT](./LICENSE)
