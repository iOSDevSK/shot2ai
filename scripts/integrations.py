"""Generate stable website tags from reviewed URL + prompt registrations.

python3 scripts/integrations.py             # write public + bundled registries
python3 scripts/integrations.py --validate  # validate a PR, show its tags
python3 scripts/integrations.py --check     # check generated files are current
"""
import argparse
import hashlib
import re
import json
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parent.parent
OUTPUTS = ['integrations/registry.json', 'src/integration-registry.json']


def registration(data):
    if not isinstance(data, dict) or set(data) != {'url', 'prompt'}:
        raise ValueError('Each registration must contain only url and prompt.')
    raw, prompt = data['url'], data['prompt']
    if not isinstance(raw, str) or not isinstance(prompt, str):
        raise ValueError('url and prompt must be strings.')
    url = urlsplit(raw)
    if (url.scheme != 'https' or not url.hostname or url.username or url.password
            or url.query or url.fragment or url.port not in (None, 443)
            or '*' in raw or '\\' in raw or any(ord(c) < 33 for c in raw)
            or url.hostname in ('localhost', '127.0.0.1', '::1')
            or any(ord(c) > 127 for c in url.path) or any(c in url.path for c in '<>\"`{}')
            or '%' in url.path or any(p in ('.', '..') for p in url.path.split('/'))):
        raise ValueError('Use a public HTTPS URL or path prefix, with no credentials, query, fragment or wildcards.')
    host = url.hostname.encode('idna').decode('ascii').lower()
    if not re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*[a-z0-9]', host):
        raise ValueError('Use a public website domain.')
    canonical = urlunsplit(('https', host, url.path.rstrip('/') + '/', '', ''))
    prompt = prompt.strip()
    if not prompt or len(prompt.encode('utf-16-le')) // 2 > 8000:
        raise ValueError('The prompt must contain 1 to 8,000 characters.')
    tag = 's2ai-' + hashlib.sha256(canonical.encode()).hexdigest()[:16]
    return {'tag': tag, 'url': canonical, 'prompt': prompt}


def generate(root=ROOT):
    entries = []
    for file in sorted((root / 'integrations/requests').glob('*.json')):
        try:
            entry = registration(json.loads(file.read_text()))
        except (ValueError, TypeError) as e:
            raise ValueError(f'{file.name}: {e}') from e
        if any(e['tag'] == entry['tag'] for e in entries):
            raise ValueError(f'{file.name}: duplicate URL or tag collision.')
        entries.append(entry)
    return {'schemaVersion': 1, 'integrations': sorted(entries, key=lambda e: e['tag'])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--validate', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    try:
        registry = generate()
        text = json.dumps(registry, ensure_ascii=False, indent=2) + '\n'
        for entry in registry['integrations']:
            print(f"{entry['tag']}  {entry['url']}")
        if args.validate:
            return
        for output in OUTPUTS:
            path = ROOT / output
            if args.check:
                if not path.exists() or path.read_text() != text:
                    raise ValueError(f'{output} is stale; run python3 scripts/integrations.py')
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(text)
    except ValueError as e:
        parser.exit(1, f'{e}\n')


if __name__ == '__main__':
    main()
