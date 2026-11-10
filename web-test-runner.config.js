import { esbuildPlugin } from '@web/dev-server-esbuild';

/** @type {import('@web/test-runner').TestRunnerConfig} */
export default {
  files: 'src/**/*.test.ts',
  nodeResolve: true,
  // One page at a time: focus and keyboard tests need the active tab, and background tabs
  // throttle timers.
  concurrency: 1,
  plugins: [esbuildPlugin({ ts: true, target: 'es2022', tsconfig: './tsconfig.json' })],
  testFramework: { config: { timeout: 3000 } },
};
