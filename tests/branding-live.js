export async function run(){
 const out='/tmp/reading-status-live',report={version:Zotero.version,checks:[]};let prefs;
 const check=(name,pass)=>{report.checks.push({name,pass:!!pass});if(!pass)throw Error(name);};
 try{
 const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');const own=await AddonManager.getAddonByID('reading-status-capsules@independent.local');report.pluginVersion=own.version;
 check('installed display name',own.name==='Zotero Capsules Status');
 check('manifest SVG icon exists',own.icons[48]?.endsWith('assets/icon.svg')||own.iconURL?.endsWith('assets/icon.svg'));
 prefs=Zotero.Utilities.Internal.openPreferences('reading-status-capsules-settings');for(let i=0;i<50&&!prefs.document.querySelector('.rs-brand-icon');i++)await Zotero.Promise.delay(100);
 const box=prefs.document.querySelector('.rs-settings'),img=box.querySelector('.rs-brand-icon');for(let i=0;i<50&&!img.complete;i++)await Zotero.Promise.delay(100);
 check('settings brand title',box.querySelector('h2').textContent==='Zotero Capsules Status');check('settings icon loads',img.complete&&img.naturalWidth>0);
 box.querySelector('.rs-settings-header').scrollIntoView({block:'start'});await Zotero.Promise.delay(300);
 const doc=prefs.document,canvas=doc.createElementNS('http://www.w3.org/1999/xhtml','canvas');canvas.width=prefs.innerWidth;canvas.height=prefs.innerHeight;const snap=await prefs.browsingContext.currentWindowGlobal.drawSnapshot(new prefs.DOMRect(0,0,canvas.width,canvas.height),1,'rgb(255,255,255)');canvas.getContext('2d').drawImage(snap,0,0);snap.close();await prefs.IOUtils.write(out+'/'+report.pluginVersion+'-brand-settings.png',Uint8Array.from(prefs.atob(canvas.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0)));
 for(const size of [48,128,512]){canvas.width=size;canvas.height=size;canvas.getContext('2d').drawImage(img,0,0,size,size);await prefs.IOUtils.write(out+'/icon-preview-'+size+'.png',Uint8Array.from(prefs.atob(canvas.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0)));}
 }catch(e){report.error=String(e);report.stack=e.stack;}
 finally{prefs?.close();}
 await Zotero.File.putContentsAsync(out+'/branding-report.json',JSON.stringify(report,null,2));Services.startup.quit(Ci.nsIAppStartup.eForceQuit);
}
