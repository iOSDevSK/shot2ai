import { test, expect } from '@playwright/test';
import { sendToApp } from '../src/bridge.js';
import { readSelectedText } from '../src/selection.js';

test('text selection: page, textarea, input and editable text retain Unicode and line breaks', async ({ page }) => {
  await page.setContent('<p id="text">Čistý text<br>druhý riadok 👋</p><textarea>before selected after</textarea><input value="before chosen after"><div contenteditable>editable text</div>');
  await page.locator('#text').evaluate(el => { const r = document.createRange(); r.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(r); });
  expect(await page.evaluate(readSelectedText)).toBe('Čistý text\ndruhý riadok 👋');
  for (const [selector, end, expected] of [['textarea', 15, 'selected'], ['input', 13, 'chosen']]) {
    await page.locator(selector).evaluate((el, end) => { el.focus(); el.setSelectionRange(7, end); }, end);
    expect(await page.evaluate(readSelectedText)).toBe(expected);
  }
  await page.locator('[contenteditable]').evaluate(el => { el.focus(); const r = document.createRange(); r.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(r); });
  expect(await page.evaluate(readSelectedText)).toBe('editable text');
});

test('text selection: empty selections and password fields never reveal field values or stale page selections', async ({ page }) => {
  await page.setContent('<p>Old page selection</p><input type="password" value="do-not-read"><textarea>private draft</textarea>');
  await page.locator('p').evaluate(el => { const r = document.createRange(); r.selectNodeContents(el); getSelection().addRange(r); });
  await page.locator('input').evaluate(el => { el.focus(); el.select(); });
  expect(await page.evaluate(readSelectedText)).toBe('');
  await page.locator('textarea').evaluate(el => { el.focus(); el.setSelectionRange(3, 3); });
  expect(await page.evaluate(readSelectedText)).toBe('');
});

test('text selection: focused same-origin iframe and shadow input use only their selected range', async ({ page }) => {
  await page.setContent('<div id="host"></div><iframe srcdoc="<textarea>frame selection</textarea>"></iframe>');
  await page.locator('#host').evaluate(el => { const root = el.attachShadow({ mode: 'open' }); root.innerHTML = '<input value="shadow chosen">'; root.firstChild.focus(); root.firstChild.setSelectionRange(7, 13); });
  expect(await page.evaluate(readSelectedText)).toBe('chosen');
  await page.frameLocator('iframe').locator('textarea').evaluate(el => { el.focus(); el.setSelectionRange(6, 15); });
  expect(await page.evaluate(readSelectedText)).toBe('selection');
});


test('text selection: the image-only Mac bridge refuses text locally with an actionable message', async () => {
  // No chrome storage or network stubs: this must return before probing the app.
  const result = await sendToApp('Prompt plus selected text', []);
  expect(result.ok).toBeUndefined();
  expect(result.reason).toContain('requires an image');
  expect(result.reason).toContain('Choose a web chat');
});
