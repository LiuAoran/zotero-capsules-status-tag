"""Instrument ONLY the isolated profile copy, never the production XPI."""
import zipfile,pathlib,json
base=pathlib.Path('/tmp/reading-status-live')
with zipfile.ZipFile('dist/zotero-capsules-status-'+json.loads(pathlib.Path('addon/manifest.json').read_text())['version']+'.xpi') as src,zipfile.ZipFile(base/'profile/extensions/reading-status-capsules@independent.local.xpi','w',zipfile.ZIP_DEFLATED) as dst:
 for n in src.namelist():
  data=src.read(n)
  if n=='bootstrap.js':data+=b"\nvar originalStartup = startup;\nstartup = async function(params) { await originalStartup.call(this, params); if (!Zotero.__RSC_TEST_SCHEDULED) { Zotero.__RSC_TEST_SCHEDULED = true; Services.scriptloader.loadSubScript(params.rootURI + 'live.js', this); Zotero.Promise.delay(1500).then(() => ReadingStatusLive.run()); } };\n"
  dst.writestr(n,data)
 dst.write(base/'live.js','live.js')
