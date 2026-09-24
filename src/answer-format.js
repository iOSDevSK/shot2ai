// Safe answer rendering and Markdown serialization shared by the local export page.
  const INLINE = { b: 'strong', i: 'em', s: 's', code: 'code', a: 'a', span: 'span' };
  export function inlineTo(list, into, depth = 0) {
    if (!Array.isArray(list) || depth > 24) return;
    for (const x of list) {
      if (typeof x === 'string') { into.append(document.createTextNode(x)); continue; }
      if (x?.t === 'br') { into.append(document.createElement('br')); continue; }
      let tag = INLINE[x?.t];
      if (!tag) continue;
      const safe = tag === 'a' && typeof x.href === 'string' && /^https?:\/\//i.test(x.href);
      if (tag === 'a' && !safe) tag = 'span';
      const el = document.createElement(tag);
      if (safe) { el.href = x.href; el.target = '_blank'; el.rel = 'noopener noreferrer nofollow'; }
      if (tag === 'code') el.textContent = (x.c || []).filter((c) => typeof c === 'string').join('');
      else inlineTo(x.c, el, depth + 1);
      into.append(el);
    }
  }
  export function blocksTo(list, into, depth = 0) {
    if (!Array.isArray(list) || depth > 12) return;
    for (const b of list) {
      let el = null;
      if (b?.t === 'p') { el = document.createElement('p'); inlineTo(b.c, el); }
      else if (b?.t === 'h') { el = document.createElement(`h${Math.min(6, Math.max(1, Number(b.l) || 3))}`); inlineTo(b.c, el); }
      else if (b?.t === 'pre') {
        el = document.createElement('pre');
        if (b.lang) { const lang = document.createElement('span'); lang.className = 'lang'; lang.textContent = String(b.lang).slice(0, 30); el.append(lang); }
        const code = document.createElement('code');
        code.textContent = String(b.text ?? '');
        el.append(code);
      } else if (b?.t === 'ul' || b?.t === 'ol') {
        el = document.createElement(b.t);
        if (b.t === 'ol' && Number(b.start) > 1) el.start = Number(b.start);
        for (const item of Array.isArray(b.items) ? b.items : []) {
          const li = document.createElement('li');
          // A list item of one paragraph shows as a line, not a spaced paragraph.
          if (item?.length === 1 && item[0]?.t === 'p') inlineTo(item[0].c, li); else blocksTo(item, li, depth + 1);
          el.append(li);
        }
      } else if (b?.t === 'quote') { el = document.createElement('blockquote'); blocksTo(b.c, el, depth + 1); }
      else if (b?.t === 'hr') el = document.createElement('hr');
      else if (b?.t === 'table') {
        el = document.createElement('table');
        for (const [index, row] of (Array.isArray(b.rows) ? b.rows : []).entries()) {
          const tr = document.createElement('tr');
          for (const cell of Array.isArray(row) ? row : []) { const td = document.createElement(b.head && index === 0 ? 'th' : 'td'); inlineTo(cell, td); tr.append(td); }
          el.append(tr);
        }
      }
      if (el) into.append(el);
    }
  }
  // The same tree as Markdown, for "Copy answer".
  export function inlineMd(list) {
    return (Array.isArray(list) ? list : []).map((x) => {
      if (typeof x === 'string') return x;
      if (x?.t === 'br') return '  \n';
      const inner = x?.t === 'code' ? (x.c || []).join('') : inlineMd(x?.c);
      return { b: `**${inner}**`, i: `*${inner}*`, s: `~~${inner}~~`, code: `\`${inner}\``, a: `[${inner}](${x?.href})`, span: inner }[x?.t] ?? '';
    }).join('');
  }
  export function markdown(list, indent = '') {
    const out = [];
    for (const b of Array.isArray(list) ? list : []) {
      if (b?.t === 'p') out.push(inlineMd(b.c));
      else if (b?.t === 'h') out.push(`${'#'.repeat(Math.min(6, Math.max(1, Number(b.l) || 3)))} ${inlineMd(b.c)}`);
      else if (b?.t === 'pre') out.push(`\`\`\`${b.lang || ''}\n${b.text || ''}\n\`\`\``);
      else if (b?.t === 'ul' || b?.t === 'ol') {
        out.push((b.items || []).map((item, n) => {
          const mark = b.t === 'ol' ? `${(Number(b.start) || 1) + n}. ` : '- ';
          const body = markdown(item, ' '.repeat(mark.length)).replace(/\n\n/g, '\n');
          return `${mark}${body.trimStart()}`;
        }).join('\n'));
      } else if (b?.t === 'quote') out.push(markdown(b.c).split('\n').map((l) => `> ${l}`).join('\n'));
      else if (b?.t === 'hr') out.push('---');
      else if (b?.t === 'table') {
        const rows = (b.rows || []).map((r) => `| ${(r || []).map((c) => inlineMd(c).replace(/\|/g, '\\|')).join(' | ')} |`);
        if (b.head && rows.length) rows.splice(1, 0, `|${(b.rows[0] || []).map(() => ' --- ').join('|')}|`);
        out.push(rows.join('\n'));
      }
    }
    return out.join('\n\n').split('\n').map((l, n) => (n && l ? indent + l : l)).join('\n');
  }

  // "Copy answer": the answer as Markdown, then its sources.
  export function answerText(a) {
    const sources = (Array.isArray(a?.sources) ? a.sources : []).filter((x) => /^https?:\/\//i.test(x?.href || ''));
    return markdown(a?.blocks) + (sources.length ? `\n\nSources:\n${sources.map((x, n) => `${n + 1}. [${x.title || x.href}](${x.href})`).join('\n')}` : '');
  }
