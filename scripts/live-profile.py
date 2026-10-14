import pathlib,zipfile,json
base=pathlib.Path('/tmp/reading-status-live');profile=base/'profile';data=base/'data';profile.mkdir(parents=True,exist_ok=True);data.mkdir(exist_ok=True);(profile/'extensions').mkdir(exist_ok=True)
prefs={'extensions.autoDisableScopes':0,'extensions.enabledScopes':15,'extensions.zotero.useDataDir':True,'extensions.zotero.dataDir':str(data),'extensions.zotero.firstRun2':False,'extensions.zotero.sync.autoSync':False,'extensions.zotero.firstRun.skipFirefoxProfileAccessCheck':True,'extensions.zoteroOpenOfficeIntegration.skipInstallation':True,'extensions.zoteroWinWordIntegration.skipInstallation':True,'extensions.zoteroMacWordIntegration.skipInstallation':True,'browser.shell.checkDefaultBrowser':False,'toolkit.startup.max_resumed_crashes':-1,'extensions.zotero.debug.log':False}
(profile/'user.js').write_text('\n'.join('user_pref('+json.dumps(k)+', '+json.dumps(v)+');' for k,v in prefs.items()))
# The instrumenter always writes a separate temporary copy of the release XPI.
import subprocess
subprocess.run(['python3','scripts/instrument-live.py'],check=True)
# A valid blank PDF for the linked-file attachment fixture.
objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R >>',b'<< /Length 0 >>\nstream\n\nendstream']
content=bytearray(b'%PDF-1.4\n');offsets=[0]
for i,obj in enumerate(objects,1):
 offsets.append(len(content));content.extend(str(i).encode()+b' 0 obj\n'+obj+b'\nendobj\n')
xref=len(content);content.extend(b'xref\n0 5\n0000000000 65535 f \n')
for off in offsets[1:]:content.extend(f'{off:010d} 00000 n \n'.encode())
content.extend(f'trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode());(base/'fixture.pdf').write_bytes(content)
