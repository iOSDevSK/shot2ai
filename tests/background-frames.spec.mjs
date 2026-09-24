import { test, expect } from '@playwright/test';
import { backgroundFrames } from '../src/background-frames.js';

async function setup(page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    window.nativeFrames = new Map();
    let id = 0;
    window.requestAnimationFrame = (cb) => { window.nativeFrames.set(++id, cb); return id; };
    window.cancelAnimationFrame = (id) => window.nativeFrames.delete(id);
    window.originalRequest = window.requestAnimationFrame;
    window.originalCancel = window.cancelAnimationFrame;
    window.calls = [];
  });
}
const control = (page, action, token = 'one') => page.evaluate(({ source, action, token }) => (0, eval)(`(${source})`)(action, token), { source: backgroundFrames.toString(), action, token });

test('background frames: a suspended frame runs once, cancelled frames never run', async ({ page }) => {
  await setup(page);
  await control(page, 'start');
  await page.evaluate(() => {
    requestAnimationFrame(function (time) { window.calls.push([typeof time, this === window]); });
    cancelAnimationFrame(requestAnimationFrame(() => window.calls.push('cancelled')));
  });
  await expect.poll(() => page.evaluate(() => window.calls)).toEqual([['number', true]]);
  expect(await page.evaluate(() => window.nativeFrames.size)).toBe(0);
  await control(page, 'pulse');
  expect(await page.evaluate(() => window.calls)).toEqual([['number', true]]);
  await control(page, 'stop');
});

test('background frames: native frame wins the timer race without a duplicate callback', async ({ page }) => {
  await setup(page);
  await control(page, 'start');
  await page.evaluate(() => {
    const id = requestAnimationFrame((t) => window.calls.push(t));
    window.nativeFrames.get(id)(42);
  });
  await page.waitForTimeout(160);
  expect(await page.evaluate(() => window.calls)).toEqual([42]);
  await control(page, 'stop');
});

test('background frames: concurrent watches restore the scheduler only after the last release', async ({ page }) => {
  await setup(page);
  await control(page, 'start');
  await control(page, 'start', 'two');
  await control(page, 'stop');
  await page.evaluate(() => requestAnimationFrame(() => window.calls.push('second watch')));
  await expect.poll(() => page.evaluate(() => window.calls)).toEqual(['second watch']);
  await control(page, 'stop', 'two');
  expect(await page.evaluate(() => requestAnimationFrame === window.originalRequest && cancelAnimationFrame === window.originalCancel && !window.__shot2aiBackgroundFrames)).toBe(true);
});

test('background frames: abandoned leases expire, leaving pending native callbacks intact', async ({ page }) => {
  await page.clock.install();
  await setup(page);
  await control(page, 'start');
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }));
  await page.evaluate(() => requestAnimationFrame(() => window.calls.push('native after cleanup')));
  await page.clock.fastForward(120001);
  expect(await page.evaluate(() => requestAnimationFrame === window.originalRequest && !window.__shot2aiBackgroundFrames)).toBe(true);
  await page.evaluate(() => { for (const cb of [...window.nativeFrames.values()]) cb(performance.now()); });
  expect(await page.evaluate(() => window.calls)).toEqual(['native after cleanup']);
});

test('background frames: polling wakes a frame queued while visible after the tab becomes hidden', async ({ page }) => {
  await setup(page);
  await control(page, 'start');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    requestAnimationFrame(() => window.calls.push('resumed'));
  });
  await page.waitForTimeout(110);
  expect(await page.evaluate(() => window.calls)).toEqual([]);
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
  await control(page, 'pulse');
  expect(await page.evaluate(() => window.calls)).toEqual(['resumed']);
  await control(page, 'stop');
});
