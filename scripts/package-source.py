"""Create a source archive from an explicit public-source allowlist."""
import hashlib
import json
import pathlib
import zipfile

root = pathlib.Path(__file__).resolve().parents[1]
version = json.loads((root / 'addon/manifest.json').read_text())['version']
output = root / 'dist'
output.mkdir(exist_ok=True)
artifact = output / f'zotero-capsules-status-{version}-source.zip'
entries = ['addon', 'src', 'tests', 'scripts', 'docs', 'licenses', 'README.md',
           'README.en.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'package.json',
           'package-lock.json', '.gitignore', '.prettierrc.json']
with zipfile.ZipFile(artifact, 'w', zipfile.ZIP_DEFLATED) as archive:
    for entry in entries:
        source = root / entry
        files = sorted(source.rglob('*')) if source.is_dir() else [source]
        for file in files:
            if file.is_file() and not file.is_symlink() and not any(
                part in {'__pycache__', '.DS_Store'} for part in file.relative_to(root).parts
            ):
                archive.write(file, pathlib.Path('zotero-capsules-status') / file.relative_to(root))
with zipfile.ZipFile(artifact) as archive:
    assert archive.testzip() is None
xpi = output / f'zotero-capsules-status-{version}.xpi'
checksums = output / f'SHA256SUMS-{version}.txt'
checksums.write_text(''.join(hashlib.sha256(file.read_bytes()).hexdigest() + '  ' + file.name + '\n'
                             for file in [xpi, artifact]))
print(artifact)
print(checksums)
