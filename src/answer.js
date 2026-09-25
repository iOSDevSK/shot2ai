// The chat's answer, back on the owner's page. After a confirmed send to
// ChatGPT, Claude, Gemini or Perplexity, the service worker reads the newest answer in the chat's
// tab every moment and passes it to the card in the tab the screenshot came
// from. It reads only that chat's answer to this message: the page's own
// text as it is shown, never its cookies or its data. The answer travels as
// a small tree of paragraphs, lists, code and links (see `readAnswer`), never
// as the page's HTML, and the card builds it with text only.
//
// Polling from here, rather than a script in the chat's page that reports
// changes over a port: each short read keeps this service worker awake for as
// long as the answer takes (an open port alone does not), and the watch, its
// timeouts and the relay stay in one place.
import { updateCapture, getCapture } from './captures.js';
import { rememberConversation } from './webchat.js';
import { controlBackgroundFrames } from './background-frames.js';

// poll: between reads. settle: an answer that stopped changing, with no stop
// button, is finished after this (longer when no stop button was ever seen).
// quiet: nothing happening at all (no stop button, no new text) for this long
// means the chat is not answering. total: the longest Shot2AI waits.
export const TIMING = { poll: 800, settle: 1600, settleUnsure: 5000, quiet: 45000, total: 360000, heartbeat: 5000 };

// Runs in the chat's page: the answer to the owner's newest message, as
// blocks. Match the sent question and its message identity: virtualized chats
// can remove older turns, so message counts need not increase. Stop at the
// next user message. Older captures/providers retain their count fallback.
// Only these kinds survive:
// p, h (1–6), ul/ol (items of blocks), pre (text), quote (blocks), hr, table
// (rows of cells); inside a block, text, b, i, s, code, br and links to
// http(s) addresses. Images, scripts, buttons, styles and hidden parts are
// left out; every attribute but a link's address is dropped.
export function readAnswer(sel, baseline) {
  const all = (list) => { for (const s of list) { const found = [...document.querySelectorAll(s)]; if (found.length) return found; } return []; };
  const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const stop = sel.stop.some((s) => [...document.querySelectorAll(s)].some(shown));
  const streaming = sel.streaming.some((s) => document.querySelector(s));
  // Nested matches (a wrapper and its message both matching) count once.
  const messages = all(sel.answers).filter((el, i, list) => !list.some((other, j) => j !== i && other.contains(el) && other !== el));
  const mine = all(sel.user);
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
  const identity = (el) => {
    for (const attr of sel.identity || []) {
      const value = el.closest(`[${attr}]`)?.getAttribute(attr)?.trim();
      if (value) return `${attr}:${value}`;
    }
    return '';
  };
  let asked = null;
  const tracked = !!baseline.question && !!sel.identity?.length;
  if (tracked) {
    const matching = mine.filter(el => normalize(el.innerText || el.textContent) === baseline.question);
    asked = baseline.sentUser ? matching.find(el => identity(el) === baseline.sentUser) : null;
    if (!asked) {
      const fresh = matching.filter(el => {
        const id = identity(el);
        return id ? !(baseline.userKeys || []).includes(id) : mine.indexOf(el) >= baseline.user;
      });
      // Ambiguous repeated questions must never return a different turn.
      if (fresh.length === 1) asked = fresh[0];
    }
    // Older/provider layouts can include attachment labels in the user text
    // and expose no stable identity. Keep their count-based turn boundary.
    if (!asked && !mine.some(el => identity(el))) asked = mine[baseline.user] || null;
  } else if (mine.length > baseline.user) asked = mine[mine.length - 1];
  const next = asked && mine[mine.indexOf(asked) + 1];
  const answer = asked ? messages.filter(m => (asked.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING)
    && (!next || (m.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING)))
    : !tracked && messages.length > baseline.answers ? [messages[messages.length - 1]] : [];
  const out = { question: normalize(asked?.innerText || asked?.textContent), userKey: asked ? identity(asked) : '', started: answer.length > 0, stop, streaming, blocks: [], sources: [], truncated: false, url: location.href };
  if (!answer.length) return out;
  // Sources the chat lists with its answer (Perplexity): links to other sites,
  // from the answer's own entry on the page, eight at most.
  if (sel.sources.length) {
    const entry = sel.entry.map((s) => answer[0].closest(s)).find(Boolean) || answer[0].parentElement || answer[0];
    const seen = new Set();
    for (const s of sel.sources) {
      for (const link of entry.querySelectorAll(s)) {
        let href = '';
        try { const u = new URL(link.getAttribute('href') || '', location.href); if (/^https?:$/.test(u.protocol) && u.origin !== location.origin) href = u.href; } catch { /* not an address */ }
        if (!href || seen.has(href) || out.sources.length >= 8) continue;
        seen.add(href);
        const title = (link.getAttribute('title') || link.textContent || '').replace(/\s+/g, ' ').trim();
        out.sources.push({ href, title: (title.length > 3 ? title : new URL(href).hostname).slice(0, 120) });
      }
    }
  }
  const roots = [];
  for (const message of answer) {
    let found = [];
    for (const s of sel.content) { found = [...message.querySelectorAll(s)].filter((el, i, list) => !list.some((o) => o !== el && o.contains(el))); if (found.length) break; }
    roots.push(...(found.length ? found : [message]));
  }

  let budget = 200000;
  const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|SVG|BUTTON|INPUT|TEXTAREA|SELECT|OPTION|IMG|PICTURE|SOURCE|VIDEO|AUDIO|CANVAS|IFRAME|OBJECT|EMBED|FORM|DIALOG|MATH)$/;
  const BLOCKS = /^(P|DIV|SECTION|ARTICLE|MAIN|HEADER|FOOTER|ASIDE|NAV|FIGURE|FIGCAPTION|DETAILS|SUMMARY|H[1-6]|UL|OL|LI|PRE|BLOCKQUOTE|TABLE|THEAD|TBODY|TFOOT|TR|TD|TH|HR|DL|DT|DD)$/;
  const skip = (el) => {
    if (SKIP.test(el.tagName.toUpperCase()) || el.getAttribute('aria-hidden') === 'true' || el.hidden) return true;
    const style = getComputedStyle(el);
    return style.display === 'none' || style.visibility === 'hidden';
  };
  const text = (t) => { if (budget <= 0) { out.truncated = true; return ''; } const cut = t.slice(0, budget); budget -= cut.length; if (cut.length < t.length) out.truncated = true; return cut; };
  // A formula shows as its TeX source.
  const tex = (el) => el.querySelector('annotation[encoding="application/x-tex"]')?.textContent || el.textContent || '';

  function inline(nodes, into) {
    for (const n of nodes) {
      if (n.nodeType === Node.TEXT_NODE) { const t = text(n.nodeValue.replace(/\s+/g, ' ')); if (t) into.push(t); continue; }
      if (n.nodeType !== Node.ELEMENT_NODE) continue;
      if (n.classList?.contains('katex')) { into.push({ t: 'code', c: [text(tex(n))] }); continue; }
      if (skip(n)) continue;
      const tag = n.tagName.toUpperCase();
      if (tag === 'BR') { into.push({ t: 'br' }); continue; }
      const kind = { STRONG: 'b', B: 'b', EM: 'i', I: 'i', S: 's', DEL: 's', CODE: 'code', KBD: 'code', A: 'a' }[tag];
      if (!kind) { inline(n.childNodes, into); continue; }
      const c = [];
      if (kind === 'code') { const t = text(n.textContent); if (t) c.push(t); } else inline(n.childNodes, c);
      if (!c.length) continue;
      if (kind === 'a') {
        let href = '';
        try { const u = new URL(n.getAttribute('href') || '', location.href); if (/^https?:$/.test(u.protocol)) href = u.href; } catch { /* not an address */ }
        into.push(href ? { t: 'a', href, c } : { t: 'span', c });
        continue;
      }
      into.push({ t: kind, c });
    }
    return into;
  }
  const trimmed = (c) => {
    while (c.length && typeof c[0] === 'string' && !c[0].trim()) c.shift();
    while (c.length && typeof c.at(-1) === 'string' && !c.at(-1).trim()) c.pop();
    if (typeof c[0] === 'string') c[0] = c[0].replace(/^\s+/, '');
    if (typeof c.at(-1) === 'string') c[c.length - 1] = c.at(-1).replace(/\s+$/, '');
    return c;
  };

  // Children of a block element, as blocks: runs of inline content become
  // paragraphs, block elements their own kind.
  function blocks(node, into) {
    let run = [];
    const flush = () => { const c = trimmed(run); if (c.length) into.push({ t: 'p', c }); run = []; };
    for (const n of node.childNodes) {
      if (n.nodeType === Node.ELEMENT_NODE && !n.classList?.contains('katex') && !skip(n) && BLOCKS.test(n.tagName.toUpperCase())) { flush(); block(n, into); continue; }
      inline([n], run);
    }
    flush();
    return into;
  }
  function block(el, into) {
    const tag = el.tagName.toUpperCase();
    if (/^H[1-6]$/.test(tag)) { const c = trimmed(inline(el.childNodes, [])); if (c.length) into.push({ t: 'h', l: Number(tag[1]), c }); return; }
    if (tag === 'PRE') {
      const code = el.querySelector('code');
      const lang = ((code?.className || '').match(/language-([\w+#.-]+)/) || [])[1] || '';
      into.push({ t: 'pre', lang, text: text((code || el).textContent.replace(/\n$/, '')) });
      return;
    }
    if (tag === 'UL' || tag === 'OL') {
      const items = [...el.children].filter((li) => li.tagName.toUpperCase() === 'LI' && !skip(li)).map((li) => blocks(li, []));
      if (items.length) into.push({ t: tag === 'OL' ? 'ol' : 'ul', start: Number(el.getAttribute('start')) || 1, items });
      return;
    }
    if (tag === 'BLOCKQUOTE') { const c = blocks(el, []); if (c.length) into.push({ t: 'quote', c }); return; }
    if (tag === 'HR') { into.push({ t: 'hr' }); return; }
    if (tag === 'TABLE') {
      const rows = [...el.querySelectorAll('tr')].map((tr) => [...tr.children].filter((cell) => /^(TD|TH)$/.test(cell.tagName.toUpperCase())).map((cell) => trimmed(inline(cell.childNodes, []))));
      if (rows.length) into.push({ t: 'table', head: !!el.querySelector('thead, th'), rows });
      return;
    }
    blocks(el, into);
  }
  for (const root of roots) blocks(root, out.blocks);
  return out;
}

export const answerSelectors = (destination) => ({
  answers: destination.answerSelectors || [], content: destination.contentSelectors || [], stop: destination.stopSelectors || [], streaming: destination.streamingSelectors || [],
  user: destination.userSelectors || [], sources: destination.sourceSelectors || [], entry: destination.entrySelectors || [],
  identity: destination.messageIdentity || [],
});

const jobs = new Map();

function relay(job, answer) {
  job.sentAt = Date.now();
  chrome.tabs.sendMessage(job.originTabId, { type: 'shot2ai-answer', id: job.captureId, answer }, { frameId: 0 }).catch(() => { /* the card is not there now; it shows what is kept */ });
}
function snapshot(job, state, blocks = job.blocks, truncated = job.truncated) {
  return { state, turnId: job.turnId, url: job.url, name: job.name, destination: job.destination, tabId: job.chatTabId, blocks, sources: job.sources, truncated: !!truncated };
}
async function finish(job, state) {
  if (jobs.get(job.captureId) !== job) return;
  jobs.delete(job.captureId);
  clearTimeout(job.timer);
  await controlBackgroundFrames(job.chatTabId, job.frameToken, 'stop').catch(() => {});
  const answer = snapshot(job, state);
  // Where this conversation is now (a new chat gets its own address once it starts).
  if (job.url) await rememberConversation(job.site, job.url).catch(() => {});
  if (await getCapture(job.captureId).catch(() => null)) await updateCapture(job.captureId, { answer }).catch(() => {});
  relay(job, answer);
}

async function tick(job) {
  if (jobs.get(job.captureId) !== job) return;
  const now = Date.now();
  let snap;
  try {
    await controlBackgroundFrames(job.chatTabId, job.frameToken, 'pulse');
    [{ result: snap }] = await chrome.scripting.executeScript({ target: { tabId: job.chatTabId }, func: readAnswer, args: [job.selectors, job.baseline] });
  } catch {
    // The chat's tab was closed, or went where Shot2AI may not read.
    await finish(job, 'gone');
    return;
  }
  if (jobs.get(job.captureId) !== job) return;
  if (!snap) { job.timer = setTimeout(() => void tick(job), TIMING.poll); return; }
  if (snap.userKey) job.baseline.sentUser = snap.userKey;
  if (snap.url) job.url = snap.url;
  const key = JSON.stringify([snap.blocks, snap.sources]);
  const started = snap.started && snap.blocks.length > 0;
  if (key !== job.key) { job.key = key; job.changedAt = now; job.activeAt = now; job.blocks = snap.blocks; job.sources = snap.sources; job.truncated = snap.truncated; }
  if (snap.stop || snap.streaming) { job.activeAt = now; job.sawStop = job.sawStop || snap.stop; }
  const still = now - job.changedAt;
  if (started && !snap.stop && !snap.streaming && still >= (job.sawStop ? TIMING.settle : TIMING.settleUnsure)) { await finish(job, 'done'); return; }
  // The chat answered and stopped, but no answer could be read here.
  if (!started && job.sawStop && !snap.stop && !snap.streaming && now - job.activeAt >= TIMING.settle * 2) { await finish(job, 'unreadable'); return; }
  if (now - job.activeAt >= TIMING.quiet || now - job.startedAt >= TIMING.total) { await finish(job, 'timeout'); return; }
  // New text goes to the card at once; otherwise a heartbeat, so the card
  // knows the service worker is still watching.
  if (key !== job.relayedKey || now - job.sentAt >= TIMING.heartbeat) { job.relayedKey = key; relay(job, snapshot(job, 'answering')); }
  job.timer = setTimeout(() => void tick(job), TIMING.poll);
}

// Starts reading the answer to a capture just sent.
export function watchAnswer({ captureId, originTabId, chatTabId, destination, baseline, frameToken = null, turnId = null, url = null }) {
  stopAnswer(captureId);
  const now = Date.now();
  const job = {
    captureId, originTabId, chatTabId, frameToken, name: destination.name, destination: destination.id, site: destination, turnId, url,
    baseline: { answers: baseline?.answers || 0, user: baseline?.user || 0, question: baseline?.question || '', userKeys: baseline?.userKeys || [], sentUser: baseline?.sentUser || '' },
    selectors: answerSelectors(destination),
    startedAt: now, changedAt: now, activeAt: now, sentAt: 0, key: '[[],[]]', relayedKey: null, blocks: [], sources: [], truncated: false, sawStop: false, timer: 0,
  };
  jobs.set(captureId, job);
  updateCapture(captureId, { answer: snapshot(job, 'answering') }).catch(() => {});
  job.timer = setTimeout(() => void tick(job), TIMING.poll);
}
export function stopAnswer(captureId) {
  const job = jobs.get(captureId);
  if (!job) return;
  clearTimeout(job.timer);
  jobs.delete(captureId);
  void controlBackgroundFrames(job.chatTabId, job.frameToken, 'stop').catch(() => {});
}
// The owner's tab closed: its answers are no longer wanted.
export function stopAnswersFor(tabId) {
  for (const job of [...jobs.values()]) if (job.originTabId === tabId) stopAnswer(job.captureId);
}
