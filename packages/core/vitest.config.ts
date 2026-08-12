import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./vitest.global-setup.ts'],
    // persistence/*.test.ts が1つのテスト用 DB ファイルを共有するため、
    // テストファイルを逐次実行する（docs/phase1/units/prt-b9-persistence.md 3章）。
    fileParallelism: false,
  },
});
