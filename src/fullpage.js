// Full-page capture: scroll the page (or its largest inner scroller) one
// screen at a time, capture each screen, and stitch the screens into one
// image. Fixed and sticky elements are hidden after the first screen so a
// header appears once; every style changed and the scroll position are put
// back. Infinite feeds stop at a height, a screen count, or when the page
// keeps growing at its bottom.
import { putCapture } from './captures.js';
import { captureTab } from './capture.js';

// The largest canvas side Chrome draws reliably, and the smallest scale we
// accept before splitting the page into several images instead.
const MAX_SIDE = 16384;
const MIN_SCALE = 0.5;
export const MAX_FRAMES = 30;
export const DEFAULT_MAX_HEIGHT = 20000;

const cancelled = new Set();
export const cancelFullPage = (tabId) => cancelled.add(tabId);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fmt = (n) => Math.round(n).toLocaleString('en-US');

// ---- in the page ---------------------------------------------------------

function pagePrepare() {
  const doc = document.scrollingElement || document.documentElement;
  let el = null;
  if (doc.scrollHeight <= innerHeight + 2) {
    // The page itself does not scroll: take the largest scrollable element.
    let best = 0;
    for (const e of document.querySelectorAll('body *')) {
      if (e.scrollHeight <= e.clientHeight + 2 || e.clientHeight < 100) continue;
      const style = getComputedStyle(e);
      if (!/(auto|scroll|overlay)/.test(style.overflowY)) continue;
      const area = e.clientWidth * e.clientHeight;
      if (area > best) { best = area; el = e; }
    }
  }
  const target = el || doc;
  const rect = el ? el.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
  const state = { el, start: el ? el.scrollTop : scrollY, startX: el ? el.scrollLeft : scrollX, hidden: [], behavior: document.documentElement.style.scrollBehavior, targetBehavior: target.style?.scrollBehavior };
  // Smooth scrolling would make every step land late.
  document.documentElement.style.scrollBehavior = 'auto';
  if (el) el.style.scrollBehavior = 'auto';
  window.__shot2aiFull = state;
  const viewH = el ? el.clientHeight : innerHeight;
  return {
    inner: !!el, vw: innerWidth, vh: innerHeight, viewH, scrollH: target.scrollHeight, start: state.start,
    rect: { x: Math.max(0, rect.left), y: Math.max(0, rect.top), width: Math.min(rect.width, innerWidth), height: Math.min(viewH, innerHeight - Math.max(0, rect.top)) },
  };
}

async function pageStep(y, hideFixed) {
  const state = window.__shot2aiFull;
  const el = state.el;
  if (el) el.scrollTop = y; else window.scrollTo(state.startX, y);
  if (hideFixed && !state.fixedHidden) {
    state.fixedHidden = true;
    for (const e of document.querySelectorAll('body *')) {
      if (e.id?.startsWith('shot2ai-')) continue;
      const pos = getComputedStyle(e).position;
      if (pos !== 'fixed' && pos !== 'sticky') continue;
      state.hidden.push([e, e.style.getPropertyValue('visibility'), e.style.getPropertyPriority('visibility')]);
      e.style.setProperty('visibility', 'hidden', 'important');
    }
  }
  // Let the page settle and the images now in view load.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 150));
  const inView = [...document.images].filter((img) => { const r = img.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; });
  await Promise.race([Promise.all(inView.map((img) => img.decode().catch(() => {}))), new Promise((r) => setTimeout(r, 400))]);
  // Shot2AI's own card, toolbar and progress stay out of the picture.
  for (const id of ['shot2ai-preview-card', 'shot2ai-toolbar', 'shot2ai-progress']) {
    const host = document.getElementById(id);
    if (host) host.style.visibility = 'hidden';
  }
  const target = el || document.scrollingElement || document.documentElement;
  return { y: el ? el.scrollTop : scrollY, scrollH: target.scrollHeight };
}

function pageReveal() {
  for (const id of ['shot2ai-preview-card', 'shot2ai-toolbar', 'shot2ai-progress']) {
    const host = document.getElementById(id);
    if (host) host.style.visibility = '';
  }
}

function pageHeight() {
  const state = window.__shot2aiFull;
  return (state.el || document.scrollingElement || document.documentElement).scrollHeight;
}

function pageRestore() {
  const state = window.__shot2aiFull;
  if (!state) return;
  for (const [e, value, priority] of state.hidden) {
    if (value) e.style.setProperty('visibility', value, priority); else e.style.removeProperty('visibility');
  }
  if (state.el) { state.el.scrollTop = state.start; state.el.scrollLeft = state.startX; state.el.style.scrollBehavior = state.targetBehavior || ''; }
  else window.scrollTo(state.startX, state.start);
  document.documentElement.style.scrollBehavior = state.behavior || '';
  for (const id of ['shot2ai-preview-card', 'shot2ai-toolbar', 'shot2ai-progress']) {
    const host = document.getElementById(id);
    if (host) host.style.visibility = '';
  }
  delete window.__shot2aiFull;
}

// ---- in the service worker ----------------------------------------------

async function run(tabId, func, args = []) {
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return result;
}


// Returns { parts: [{ id, capture }], note } or { cancelled: true }.
// `progress(done, total)` is called after each screen.
export async function captureFullPage(tab, { maxHeight = DEFAULT_MAX_HEIGHT, progress = () => {} } = {}) {
  cancelled.delete(tab.id);
  if (!tab.active) { await chrome.tabs.update(tab.id, { active: true }); await wait(200); }
  const m = await run(tab.id, pagePrepare);
  const frames = [];
  let stop = null;
  let grew = false;
  try {
    let y = 0;
    let growth = 0;
    for (;;) {
      if (cancelled.has(tab.id)) return { cancelled: true };
      const at = await run(tab.id, pageStep, [y, frames.length > 0]);
      const shot = await captureTab(tab.windowId);
      await run(tab.id, pageReveal);
      frames.push({ y: at.y, blob: await (await fetch(shot)).blob() });
      const covered = at.y + m.viewH;
      if (at.scrollH > m.scrollH + 1) grew = true;
      progress(frames.length, Math.max(frames.length, Math.ceil(Math.min(at.scrollH, maxHeight) / m.viewH)));
      if (covered >= maxHeight) { stop = 'height'; break; }
      if (frames.length >= MAX_FRAMES) { stop = 'frames'; break; }
      if (covered >= at.scrollH - 1) {
        // At the bottom: an infinite feed grows here. Twice, and it is one.
        await wait(1200);
        if ((await run(tab.id, pageHeight)) > at.scrollH + 1) {
          grew = true;
          growth += 1;
          if (growth >= 2) { stop = 'growth'; break; }
        } else break;
      }
      y = at.y + m.viewH;
    }
  } finally {
    await run(tab.id, pageRestore).catch(() => {});
    cancelled.delete(tab.id);
  }
  return stitch(tab, m, frames, maxHeight, stop, grew);
}

async function stitch(tab, m, frames, maxHeight, stop, grew) {
  const first = await createImageBitmap(frames[0].blob);
  const k = first.width / m.vw; // device pixels per CSS pixel
  first.close();
  const cssHeight = Math.min(maxHeight, frames.at(-1).y + m.viewH);
  const cssWidth = m.rect.width;
  const deviceHeight = cssHeight * k;
  // Within the browser's canvas limits: one image, scaled down if needed,
  // or several images once scaling would go below half size.
  let scale = 1;
  let parts = 1;
  if (deviceHeight > MAX_SIDE) {
    scale = MAX_SIDE / deviceHeight;
    if (scale < MIN_SCALE) { scale = MIN_SCALE; parts = Math.ceil((deviceHeight * scale) / MAX_SIDE); }
  }
  const out = [];
  const partCss = cssHeight / parts;
  for (let p = 0; p < parts; p++) {
    const top = p * partCss;
    const bottom = Math.min(cssHeight, (p + 1) * partCss);
    const width = Math.round(cssWidth * k * scale);
    const height = Math.round((bottom - top) * k * scale);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    for (const f of frames) {
      const from = Math.max(top, f.y);
      const to = Math.min(bottom, f.y + m.viewH);
      if (to <= from) continue;
      const bitmap = await createImageBitmap(f.blob);
      const sy = (m.rect.y + (from - f.y)) * k;
      ctx.drawImage(bitmap, m.rect.x * k, sy, cssWidth * k, (to - from) * k, 0, (from - top) * k * scale, width, (to - from) * k * scale);
      bitmap.close();
    }
    const png = await canvas.convertToBlob({ type: 'image/png' });
    const capture = { png, width, height, scale: k * scale, url: tab.url || '', title: tab.title || '', tabId: tab.id, tabIndex: tab.index, kind: 'full' };
    const id = crypto.randomUUID();
    await putCapture(id, capture);
    out.push({ id, capture });
  }
  const notes = [];
  if (stop === 'growth' || (stop === 'height' && grew)) notes.push(`Stopped at ${fmt(cssHeight)} px (the page keeps loading more)`);
  else if (stop === 'height') notes.push(`Stopped at ${fmt(cssHeight)} px, the limit set in Options (the page is longer)`);
  if (stop === 'frames') notes.push(`Stopped after ${MAX_FRAMES} screens at ${fmt(cssHeight)} px (the page keeps loading more)`);
  if (parts > 1) notes.push(`Split into ${parts} images at ${Math.round(scale * 100)} %: the page is taller than the browser's ${fmt(MAX_SIDE)} px image limit`);
  else if (scale < 1) notes.push(`Scaled to ${Math.round(scale * 100)} % to stay within the browser's ${fmt(MAX_SIDE)} px image limit`);
  return { parts: out, note: notes.join('. ') };
}
