import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

if (process.env.DSCIMS_TEST_DATABASE_READY !== '1') {
  throw new Error('Run tests through pnpm test so they use an isolated database.');
}

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
    fileParallelism: false,
  },
});
