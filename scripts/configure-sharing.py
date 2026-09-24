"""Pin an already deployed sharing service: python3 scripts/configure-sharing.py https://share.example.com"""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import urlopen

root = Path(__file__).resolve().parent.parent
if len(sys.argv) != 2:
    raise SystemExit(__doc__)
value = sys.argv[1].rstrip('/')
url = urlsplit(value)
if url.scheme != 'https' or not url.hostname or url.username or url.password or url.path or url.query or url.fragment:
    raise SystemExit('Supply only a public HTTPS origin, without a path or credentials.')
with urlopen(value + '/health', timeout=15) as response:
    if response.geturl() != value + '/health' or json.load(response).get('ok') is not True:
        raise SystemExit('The sharing health check did not pass.')
config = root / 'src/share-config.js'
old = re.search(r"SHARE_ORIGIN\s*=\s*['\"]([^'\"]*)", config.read_text()).group(1)
manifest_path = root / 'manifest.json'
manifest = json.loads(manifest_path.read_text())
permissions = [p for p in manifest['host_permissions'] if not old or p != old + '/*']
if value + '/*' not in permissions:
    permissions.append(value + '/*')
manifest['host_permissions'] = permissions
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
config.write_text('// Verified production sharing origin. No remote code is loaded.\nexport const SHARE_ORIGIN = ' + json.dumps(value) + ';\n')
print('Sharing origin and host permission configured. Run the deployment checks, bump the version and build before releasing.')
