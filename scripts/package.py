"""Package the clean build tree; no test bridges or development dependencies."""
import json
import pathlib
import zipfile

root = pathlib.Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'addon/manifest.json').read_text())
output = root / 'dist'
output.mkdir(exist_ok=True)
artifact = output / f"zotero-capsules-status-{manifest['version']}.xpi"
with zipfile.ZipFile(artifact, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted((root / 'build').rglob('*')):
        if file.is_file() and not file.is_symlink() and file.name != '.DS_Store':
            archive.write(file, file.relative_to(root / 'build'))
with zipfile.ZipFile(artifact) as archive:
    assert archive.testzip() is None
    assert 'live.js' not in archive.namelist()
    assert b'__RSC_TEST_SCHEDULED' not in archive.read('bootstrap.js')
print(artifact)
