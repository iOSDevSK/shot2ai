"""Builds dist/shot2ai-<version>.zip: manifest.json, src, icons, licenses and
README.md, nothing else. It fails when a file that the manifest, a page, a
module import or an injected script refers to is not in the ZIP.
Run from the repo root: python3 scripts/package.py"""
import json, posixpath, re, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARTS = ['manifest.json', 'src', 'icons', 'licenses', 'README.md']

def files():
    for part in PARTS:
        path = ROOT / part
        if path.is_file():
            yield part
        else:
            yield from sorted(p.relative_to(ROOT).as_posix() for p in path.rglob('*') if p.is_file() and p.name != '.DS_Store')

def references(names):
    """(referring file, referenced path) pairs, paths relative to the ZIP root."""
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    refs = [('manifest.json', p) for p in manifest.get('icons', {}).values()]
    refs += [('manifest.json', p) for p in manifest['action'].get('default_icon', {}).values()]
    refs += [('manifest.json', manifest['background']['service_worker']), ('manifest.json', manifest['action']['default_popup']), ('manifest.json', manifest['options_ui']['page'])]
    for name in names:
        text = (ROOT / name).read_text(errors='ignore') if name.endswith(('.html', '.js', '.css')) else ''
        here = posixpath.dirname(name)
        if name.endswith('.html'):
            for url in re.findall(r'(?:src|href)="([^"#?]+)"', text):
                if not re.match(r'^[a-z]+:', url):
                    refs.append((name, posixpath.normpath(posixpath.join(here, url))))
        if name.endswith('.js'):
            for url in re.findall(r"""(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]""", text):
                refs.append((name, posixpath.normpath(posixpath.join(here, url))))
            # Extension-root paths: injected scripts and runtime URLs.
            for url in re.findall(r"""['"`]((?:src|icons)/[\w./-]+\.(?:js|html|png|css))""", text):
                refs.append((name, url))
    return refs

def main():
    version = json.loads((ROOT / 'manifest.json').read_text())['version']
    names = list(files())
    missing = [(who, ref) for who, ref in references(names) if ref not in names]
    if missing:
        for who, ref in missing:
            print(f'missing: {ref} (referenced by {who})')
        sys.exit(1)
    out = ROOT / 'dist' / f'shot2ai-{version}.zip'
    out.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for name in names:
            z.write(ROOT / name, name)
    print(f'{out.relative_to(ROOT)}: {len(names)} files, {len(references(names))} references checked, all present')

main()
