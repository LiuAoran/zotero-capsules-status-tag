// Isolated real-Zotero palette/settings verification; no library writes.
export async function run(){
 const out='/tmp/reading-status-live',report={version:Zotero.version,checks:[],palettes:[],screenshots:[]};
 let prefs,old={};const pref='extensions.readingStatusCapsules.';
 const check=(name,pass)=>{report.checks.push({name,pass:!!pass});if(!pass)throw Error(name);};
 try{
 const win=Zotero.getMainWindow(),tree=win.ZoteroPane.itemsView;await tree.waitForLoad();
 const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');report.pluginVersion=(await AddonManager.getAddonByID('reading-status-capsules@independent.local')).version;
 for(const key of ['states','theme','seed','harmonize'])old[key]=Zotero.Prefs.get(pref+key,true);
 Zotero.Prefs.set(pref+'states','{}',true);
 const id=Number(await Zotero.File.getContentsAsync(out+'/item-id.txt'));await tree.selectItems([id],true);await Zotero.Promise.delay(300);
 const item=Zotero.Items.get(id),tags=JSON.stringify(item.getTags());
 const themeFixture=await AddonManager.getAddonByID('material-theme-md3@zotero-theme.local');
 for(const enabled of [false,true]){
  if(themeFixture){if(enabled&&!themeFixture.isActive)await themeFixture.enable();if(!enabled&&themeFixture.isActive)await themeFixture.disable();}await Zotero.Promise.delay(300);
  prefs=Zotero.Utilities.Internal.openPreferences('reading-status-capsules-settings');
  for(let i=0;i<50&&!prefs.document.querySelector('.rs-harmonize');i++)await Zotero.Promise.delay(100);
  const doc=prefs.document,box=doc.querySelector('.rs-settings'),seed=box.querySelector('input[type="color"]'),mode=box.querySelector('.rs-theme-options'),toggle=box.querySelector('.rs-harmonize');
  const change=el=>el.dispatchEvent(new prefs.Event(el===seed?'input':'change',{bubbles:true}));
  const palette=()=>[...box.querySelectorAll('.rs-preview .rs-capsule')].map(b=>prefs.getComputedStyle(b).backgroundColor);
  for(const dark of [false,true]){
   mode.querySelector('[data-rs-mode="'+(dark?'dark':'light')+'"]').click();toggle.checked=true;change(toggle);
   let previous;
   for(const color of ['#6750a4','#006b59','#bc4e00']){
    seed.value=color;change(seed);await Zotero.Promise.delay(150);const colors=palette();
    check('five distinct harmonized preview colors '+enabled+' '+dark+' '+color,new Set(colors).size===5);
    if(previous)check('seed changes status colors '+enabled+' '+dark+' '+color,JSON.stringify(previous)!==JSON.stringify(colors));previous=colors;
    report.palettes.push({themeFixture:enabled,dark,seed:color,colors});
   }
   toggle.checked=false;change(toggle);await Zotero.Promise.delay(150);const untinted=palette();seed.value='#6750a4';change(seed);await Zotero.Promise.delay(150);
   check('switch restores seed-independent status colors '+enabled+' '+dark,JSON.stringify(untinted)===JSON.stringify(palette()));
   toggle.checked=true;change(toggle);await Zotero.Promise.delay(150);
   check('toggle persists '+enabled+' '+dark,Zotero.Prefs.get(pref+'harmonize',true)===true);
   box.querySelector('.rs-preview').scrollIntoView({block:'center'});await Zotero.Promise.delay(100);
   const canvas=doc.createElementNS('http://www.w3.org/1999/xhtml','canvas');canvas.width=prefs.innerWidth;canvas.height=prefs.innerHeight;const snap=await prefs.browsingContext.currentWindowGlobal.drawSnapshot(new prefs.DOMRect(0,0,canvas.width,canvas.height),1,'rgb(255,255,255)');canvas.getContext('2d').drawImage(snap,0,0);snap.close();const name=report.pluginVersion+'-'+(enabled?'themeFixture':'raw')+'-'+(dark?'dark':'light')+'-settings.png';await prefs.IOUtils.write(out+'/'+name,Uint8Array.from(prefs.atob(canvas.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0)));report.screenshots.push(name);
  }
  prefs.close();prefs=null;await Zotero.Promise.delay(150);
  const capsule=win.document.querySelector(`.rs-capsule[data-rs-row-item="${id}"]`);check('main list palette updates '+enabled,capsule&&win.getComputedStyle(capsule).backgroundColor===report.palettes.find(p=>p.themeFixture===enabled&&p.dark&&p.seed==='#6750a4').colors[1]);
 }
 check('color changes preserve all item tags',JSON.stringify(item.getTags())===tags);
 }catch(e){report.error=String(e);report.stack=e.stack;}
 finally{prefs?.close();for(const [key,value] of Object.entries(old)){if(value===undefined)Zotero.Prefs.clear(pref+key,true);else Zotero.Prefs.set(pref+key,value,true);}}
 await Zotero.File.putContentsAsync(out+'/harmonize-report.json',JSON.stringify(report,null,2));Services.startup.quit(Ci.nsIAppStartup.eForceQuit);
}
