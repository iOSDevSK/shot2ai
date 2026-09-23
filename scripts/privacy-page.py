"""Builds site/shot2ai/privacy/index.html from PRIVACY.md: one self-contained
page (no external assets) for https://html2wp.dev/shot2ai/privacy, so the
published policy and the one in the extension are the same text.
Run from the repo root: python3 scripts/privacy-page.py"""
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def inline(text):
    text = html.escape(text, quote=False)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'`(.+?)`', r'<code>\1</code>', text)
    text = re.sub(r'(https://[^\s<)]+[^\s<.,)])', r'<a href="\1">\1</a>', text)
    text = re.sub(r'([\w.+-]+@[\w-]+\.[\w.]+\w)', r'<a href="mailto:\1">\1</a>', text)
    return text

def body(markdown):
    out, items, para = [], [], []
    def flush():
        if para: out.append(f'<p>{inline(" ".join(para))}</p>'); para.clear()
        if items: out.append('<ul>' + ''.join(f'<li>{inline(i)}</li>' for i in items) + '</ul>'); items.clear()
    for line in markdown.splitlines():
        if line.startswith('# '): flush(); out.append(f'<h1>{inline(line[2:])}</h1>')
        elif line.startswith('## '): flush(); out.append(f'<h2>{inline(line[3:])}</h2>')
        elif line.startswith('- '):
            if para: flush()
            items.append(line[2:])
        elif not line.strip(): flush()
        else:
            if items: flush()
            para.append(line.strip())
    flush()
    return '\n'.join(out)

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Shot2AI privacy policy</title>
<meta name="description" content="What the Shot2AI Chrome extension captures, where it goes, and what it never does.">
<style>
:root{--ink:#232a23;--muted:#5f6b57;--line:#e3e6dd;--accent:#2f6b3f;--bg:#fafaf8;--card:#fff}
@media (prefers-color-scheme:dark){:root{--ink:#e7ebe3;--muted:#a9b3a0;--line:#2f362e;--accent:#8fd19e;--bg:#141814;--card:#1b201b}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
main{max-width:720px;margin:0 auto;padding:48px 20px 72px}
.brand{display:flex;align-items:center;gap:10px;margin-bottom:28px;font-weight:650;letter-spacing:-.01em}
.brand svg{width:30px;height:30px}
h1{margin:0 0 6px;font-size:30px;line-height:1.2;letter-spacing:-.02em}
h1 + p{margin-top:0;color:var(--muted)}
h2{margin:36px 0 10px;padding-top:20px;border-top:1px solid var(--line);font-size:19px;letter-spacing:-.01em}
p,ul{margin:0 0 14px}
ul{padding-left:22px}
li{margin:6px 0}
a{color:var(--accent);text-underline-offset:2px}
code{font:14px ui-monospace,SFMono-Regular,Menlo,monospace;padding:1px 5px;border-radius:4px;background:var(--card);border:1px solid var(--line)}
footer{margin-top:40px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:14px}
</style>
</head>
<body>
<main>
<div class="brand"><svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#16964c"/><path d="M8 13V9.5A1.5 1.5 0 0 1 9.5 8H13M19 8h3.5A1.5 1.5 0 0 1 24 9.5V13M24 19v3.5a1.5 1.5 0 0 1-1.5 1.5H19M13 24H9.5A1.5 1.5 0 0 1 8 22.5V19" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><rect x="13" y="13" width="6" height="6" rx="1.2" fill="#c8f578"/></svg>Shot2AI</div>
{body}
<footer>Shot2AI is a Chrome extension by Filip Dvoran · <a href="https://html2wp.dev/">html2wp.dev</a></footer>
</main>
</body>
</html>
"""

if __name__ == '__main__':
    out = ROOT / 'site' / 'shot2ai' / 'privacy' / 'index.html'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(PAGE.replace('{body}', body((ROOT / 'PRIVACY.md').read_text())))
    print(out.relative_to(ROOT))
