"""Keep a directly installable XPI in the tracked GitHub downloads directory."""
import hashlib
import json
import pathlib
import shutil

root = pathlib.Path(__file__).resolve().parents[1]
version = json.loads((root / 'addon/manifest.json').read_text())['version']
name = f'zotero-capsules-status-{version}.xpi'
output = root / 'downloads'
output.mkdir(exist_ok=True)
shutil.copy2(root / 'dist' / name, output / name)
(output / 'SHA256SUMS.txt').write_text(hashlib.sha256((output / name).read_bytes()).hexdigest()
                                     + '  ' + name + '\n')
print(output / name)
