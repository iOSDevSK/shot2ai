import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', testMatch: '**/*.spec.mjs', timeout: 120_000, workers: 1, reporter: 'list' });
