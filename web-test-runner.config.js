import { esbuildPlugin } from '@web/dev-server-esbuild';

/** @type {import('@web/test-runner').TestRunnerConfig} */
export default {
  files: 'src/**/*.test.ts',
  nodeResolve: true,
  plugins: [esbuildPlugin({ ts: true, target: 'es2022', tsconfig: './tsconfig.json' })],
  testFramework: { config: { timeout: 3000 } },
};
