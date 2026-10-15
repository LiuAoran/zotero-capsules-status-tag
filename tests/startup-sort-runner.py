"""Run only the isolated profile prepared by scripts/live-profile.mjs.
First launch tests/startup-sort-live.js once to create its six-item fixture.
The crash check kills only the Popen child, never an existing Zotero instance.
"""
import pathlib,json,subprocess,time
b=pathlib.Path('/tmp/reading-status-live'); fixture=b/'startup-sort-fixture.json'
version=json.loads((pathlib.Path(__file__).resolve().parents[1]/'addon/manifest.json').read_text())['version']
if not fixture.exists():
 raise SystemExit('Prepare the isolated startup-sort fixture before running this test.')
def phase(p):
 d=json.loads(fixture.read_text());d['phase']=p;fixture.write_text(json.dumps(d))
def run(p,crash=False):
 phase(p)
 if crash:(b/'crash-hold').write_text('1');(b/'crash-ready').unlink(missing_ok=True)
 report=b/f'startup-sort-{version}-{p}.json';report.unlink(missing_ok=True)
 with (b/'launch.log').open('w') as log:
  proc=subprocess.Popen(['/Applications/Zotero.app/Contents/MacOS/zotero','-purgecaches','-no-remote','-profile',str(b/'profile')],stdout=log,stderr=log)
  try:
   if crash:
    deadline=time.time()+50
    while not (b/'crash-ready').exists() and proc.poll() is None and time.time()<deadline:time.sleep(.25)
    assert (b/'crash-ready').exists(),'crash ready timed out'
    proc.kill();proc.wait(timeout=10)
    (b/'crash-process.json').write_text(json.dumps({'signal':'SIGKILL','exitCode':proc.returncode,'profile':str(b/'profile'),'dailyLibraryAccessed':False},indent=2))
   else:proc.wait(timeout=50)
  except:proc.kill();proc.wait();raise
 if crash:(b/'crash-hold').unlink()
 result=json.loads(report.read_text());print(p,'SIGKILL' if crash else '',result.get('error'),result['checks'],flush=True)
 assert not result.get('error') and all(c['pass'] for c in result['checks'])
for p in ['metadata-descending','metadata-ascending','ascending','descending','title']:run(p)
# Persist ascending before killing a subsequent test process.
run('metadata-ascending')
run('crash-reopen',True)
run('crash-reopen')
