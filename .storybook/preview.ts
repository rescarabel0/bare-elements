import type { Preview } from '@storybook/web-components-vite';

const preview: Preview = {
  parameters: {
    // Fail the a11y panel loudly: accessibility is the point of this library.
    a11y: { test: 'error' },
    controls: { expanded: true },
  },
};

export default preview;
