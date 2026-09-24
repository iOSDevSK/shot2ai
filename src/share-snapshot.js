// A deliberately small public schema. Never publish capture metadata or drafts.
export function safeShareURL(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
const text = value => typeof value === 'string' ? value : '';
function inline(values, depth = 0) {
  if (!Array.isArray(values) || depth > 24) return [];
  return values.flatMap(v => {
    if (typeof v === 'string') return [v];
    if (v?.t === 'br') return [{ t: 'br' }];
    if (!['b', 'i', 's', 'code', 'a', 'span'].includes(v?.t)) return [];
    return [{ t: v.t, c: inline(v.c, depth + 1), ...(v.t === 'a' ? { href: safeShareURL(v.href) } : {}) }];
  });
}
function blocks(values, depth = 0) {
  if (!Array.isArray(values) || depth > 12) return [];
  return values.flatMap(v => {
    if (v?.t === 'p' || v?.t === 'h') return [{ t: v.t, c: inline(v.c), ...(v.t === 'h' ? { l: Math.min(6, Math.max(1, Number(v.l) || 3)) } : {}) }];
    if (v?.t === 'pre') return [{ t: 'pre', text: text(v.text), lang: text(v.lang) }];
    if (v?.t === 'ul' || v?.t === 'ol') return [{ t: v.t, start: Math.max(1, Number(v.start) || 1), items: (Array.isArray(v.items) ? v.items : []).map(item => blocks(item, depth + 1)) }];
    if (v?.t === 'quote') return [{ t: 'quote', c: blocks(v.c, depth + 1) }];
    if (v?.t === 'hr') return [{ t: 'hr' }];
    if (v?.t === 'table') return [{ t: 'table', head: !!v.head, rows: (Array.isArray(v.rows) ? v.rows : []).map(row => (Array.isArray(row) ? row : []).map(cell => inline(cell))) }];
    return [];
  });
}
export function cleanSnapshot(snapshot) {
  return {
    kind: snapshot.kind === 'text' ? 'text' : 'image',
    selectedText: snapshot.kind === 'text' ? text(snapshot.selectedText) : '',
    url: safeShareURL(snapshot.url),
    turns: (Array.isArray(snapshot.turns) ? snapshot.turns : []).map(t => ({ asked: text(t?.asked), answer: {
      name: text(t?.answer?.name) || 'Assistant', state: t?.answer?.state === 'done' ? 'done' : 'incomplete',
      truncated: !!t?.answer?.truncated, blocks: blocks(t?.answer?.blocks),
      sources: (Array.isArray(t?.answer?.sources) ? t.answer.sources : []).map(s => ({ title: text(s?.title), href: safeShareURL(s?.href) })).filter(s => s.href),
    } })),
  };
}
export function captureSnapshot(capture) {
  return { ...cleanSnapshot({ ...capture, turns: [...(capture.history || []), { asked: capture.asked, answer: capture.answer }] }), png: capture.png };
}
export function shareExcerpt(blocks) {
  const inline = values => (values || []).map(v => typeof v === 'string' ? v : v.t === 'br' ? ' ' : inline(v.c)).join('');
  const block = values => (values || []).map(v => v.t === 'pre' ? v.text : v.items ? v.items.map(block).join(' ') : v.rows ? v.rows.map(row => row.map(inline).join(' ')).join(' ') : v.t === 'quote' ? block(v.c) : inline(v.c)).join(' ');
  return block(blocks).replace(/\s+/g, ' ').trim();
}
