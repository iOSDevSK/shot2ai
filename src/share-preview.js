import { shareExcerpt } from './share-snapshot.js';

// Social image only. The public page and downloadable exports retain the
// complete, unabridged conversation and original screenshot.
export async function makeSharePreview(snapshot) {
  const canvas = new OffscreenCanvas(1200, 630), ctx = canvas.getContext('2d');
  const ink = '#28382d', muted = '#65725f';
  const rect = (x, y, w, h, radius, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill(); };
  function words(value, x, y, width, maxLines, size, lineHeight, weight = 400, color = ink) {
    ctx.font = `${weight} ${size}px system-ui, sans-serif`; ctx.fillStyle = color; ctx.textBaseline = 'top';
    const chars = Array.from(String(value || '').replace(/\s+/g, ' ').trim());
    const lines = []; let start = 0;
    while (start < chars.length && lines.length < maxLines) {
      let end = start + 1, lastSpace = -1;
      while (end <= chars.length && ctx.measureText(chars.slice(start, end).join('')).width <= width) { if (chars[end - 1] === ' ') lastSpace = end; end++; }
      end = Math.max(start + 1, end - 1);
      if (end < chars.length && lastSpace > start && lines.length < maxLines - 1) end = lastSpace;
      let line = chars.slice(start, end).join('').trim();
      if (lines.length === maxLines - 1 && end < chars.length) {
        while (line && ctx.measureText(line + '…').width > width) line = Array.from(line).slice(0, -1).join('');
        line = line.trimEnd() + '…';
      }
      lines.push(line); start = end; while (chars[start] === ' ') start++;
    }
    lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
    return lines.length * lineHeight;
  }
  rect(0, 0, 1200, 630, 0, '#f6f7f1');
  rect(48, 38, 52, 52, 15, ink);
  ctx.strokeStyle = '#f7f9f3'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [x, y, dx, dy] of [[61,51,1,1],[87,51,-1,1],[61,77,1,-1],[87,77,-1,-1]]) { ctx.moveTo(x + dx * 7, y); ctx.lineTo(x,y); ctx.lineTo(x,y + dy * 7); }
  ctx.stroke(); rect(69,59,10,10,2,'#f7f9f3');
  words('Shot2AI', 115, 44, 260, 1, 32, 40, 750);
  words('A conversation worth sharing', 688, 51, 464, 1, 21, 30, 500, muted);
  ctx.fillStyle = '#dce2d4'; ctx.fillRect(48, 111, 1104, 1);

  rect(48, 142, 448, 392, 20, '#e6ebdf');
  if (snapshot.kind !== 'text' && snapshot.png) {
    const bitmap = await createImageBitmap(snapshot.png);
    try {
      const scale = Math.min(412 / bitmap.width, 356 / bitmap.height);
      const w = bitmap.width * scale, h = bitmap.height * scale, x = 272 - w / 2, y = 338 - h / 2;
      ctx.save(); ctx.shadowColor = '#24352c22'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
      rect(x, y, w, h, 8, '#ffffff'); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.clip(); ctx.drawImage(bitmap, x, y, w, h); ctx.restore();
    } finally { bitmap.close(); }
  } else {
    words('SELECTED TEXT', 78, 170, 386, 1, 17, 24, 650, muted);
    words(snapshot.selectedText, 78, 220, 386, 7, 26, 38, 500);
  }
  const first = snapshot.turns[0], count = snapshot.turns.length;
  words(`${first?.answer.name || 'AI'}  ·  ${count} ${count === 1 ? 'exchange' : 'exchanges'}`, 544, 148, 608, 1, 19, 28, 600, muted);
  const height = words(first?.asked || 'Explore this conversation', 544, 193, 608, 3, 42, 52, 700);
  words(shareExcerpt(first?.answer.blocks), 544, 193 + height + 25, 590, 3, 24, 34, 400, muted);
  ctx.fillStyle = '#dce2d4'; ctx.fillRect(48, 566, 1104, 1);
  words('share.shot2ai.com', 48, 586, 440, 1, 19, 26, 600);
  words('Read the full conversation  →', 805, 586, 347, 1, 19, 26, 500, muted);
  return canvas.convertToBlob({ type: 'image/png' });
}
