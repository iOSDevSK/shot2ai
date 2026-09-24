"""Builds dist/shot2ai-<version>.zip: manifest.json, src, icons, licenses,
README.md, LICENSE, THIRD-PARTY-NOTICES.md and PRIVACY.md, nothing else. It fails when a file that the manifest, a page, a
module import or an injected script refers to is not in the ZIP.
Run from the repo root: python3 scripts/package.py"""
import json, posixpath, re, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARTS = ['manifest.json', 'src', 'icons', 'licenses', 'README.md', 'integrations/README.md', 'LICENSE', 'THIRD-PARTY-NOTICES.md', 'PRIVACY.md']

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
            for url in re.findall(r"""['"`]((?:src|icons)/[\w./-]+\.(?:json|js|html|png|css))""", text):
                refs.append((name, url))
    return refs

def main():
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    version = manifest['version']
    package = json.loads((ROOT / 'package.json').read_text())
    lock = json.loads((ROOT / 'package-lock.json').read_text())
    if any(v != version for v in [package['version'], lock['version'], lock['packages']['']['version']]):
        print('manifest.json, package.json and package-lock.json must have the same version')
        sys.exit(1)
    # Chrome Web Store limits: a 75-character name, a 132-character description.
    for field, limit in (('name', 75), ('short_name', 12), ('description', 132)):
        if len(manifest[field]) > limit:
            print(f'manifest {field} is {len(manifest[field])} characters; the limit is {limit}')
            sys.exit(1)
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
