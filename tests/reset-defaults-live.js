// Exercises actual Zotero confirmation dialogs in the isolated profile.
export async function run(){
 const out='/tmp/reading-status-live',report={version:Zotero.version,checks:[],dialogs:[]};
 const key='extensions.readingStatusCapsules.',old={};let prefs,watcher;
 const check=(name,pass)=>{report.checks.push({name,pass:!!pass});if(!pass)throw Error(name);};
 const pause=()=>Zotero.Promise.delay(300);
 const snapshot=async(win,name)=>{const d=win.document,c=d.createElementNS('http://www.w3.org/1999/xhtml','canvas');c.width=win.innerWidth;c.height=win.innerHeight;const s=await win.browsingContext.currentWindowGlobal.drawSnapshot(new win.DOMRect(0,0,c.width,c.height),1,'rgb(255,255,255)');c.getContext('2d').drawImage(s,0,0);s.close();await win.IOUtils.write(out+'/'+name,Uint8Array.from(win.atob(c.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0)));};
 try{
 const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');report.pluginVersion=(await AddonManager.getAddonByID('reading-status-capsules@independent.local')).version;
 for(const name of ['theme','seed','harmonize','states'])old[name]=Zotero.Prefs.get(key+name,true);
 const tag='/reading-status/custom-reset-test',config={custom:[{tag,label:'Reset custom',color:'#008080'}],order:[tag,'/reading-status/read'],overrides:{'/reading-status/new':{label:'新文献',color:'#000000'}}};
 for(const enabled of [false,true]){
  const themeFixture=await AddonManager.getAddonByID('material-theme-md3@zotero-theme.local');if(themeFixture){if(enabled&&!themeFixture.isActive)await themeFixture.enable();if(!enabled&&themeFixture.isActive)await themeFixture.disable();}await pause();
  Zotero.Prefs.set(key+'theme','dark',true);Zotero.Prefs.set(key+'seed','#008080',true);Zotero.Prefs.set(key+'harmonize',false,true);Zotero.Prefs.set(key+'states',JSON.stringify(config),true);
  const item=new Zotero.Item('journalArticle');item.setField('title','Isolated reset defaults fixture');item.addTag(tag,0);item.addTag('/reset-keep-other',0);await item.saveTx();const before=JSON.stringify(item.getTags());
  prefs=Zotero.Utilities.Internal.openPreferences('reading-status-capsules-settings');for(let i=0;i<50&&!prefs.document.querySelector('.rs-reset');i++)await Zotero.Promise.delay(100);
  const box=prefs.document.querySelector('.rs-settings');
  for(const confirm of [false,true]){
   let handled=false;
   watcher={observe(subject,topic){if(topic!=='common-dialog-loaded')return;const dialogWin=subject.wrappedJSObject || subject;dialogWin.setTimeout(async()=>{
    try{
     const dialog=dialogWin.document.querySelector('dialog');report.dialogs.push({confirm,themeFixture:enabled,title:dialogWin.document.title,text:dialogWin.document.documentElement.textContent});
     if(confirm)try{await snapshot(dialogWin,report.pluginVersion+'-'+(enabled?'themeFixture':'raw')+'-confirm.png');}catch(e){report.dialogScreenshotError=String(e);}
     handled=true;dialog.getButton(confirm?'accept':'cancel').click();
    }catch(e){report.dialogError=String(e);dialogWin.close();}
   },100);}};
   Services.obs.addObserver(watcher,'common-dialog-loaded');box.querySelector('.rs-reset').click();Services.obs.removeObserver(watcher,'common-dialog-loaded');watcher=null;await pause();
   check('real confirmation dialog appeared '+enabled+' '+confirm,handled);
   if(!confirm){check('cancel preserves every setting '+enabled,['theme','seed','harmonize','states'].every(n=>Zotero.Prefs.get(key+n,true)==={theme:'dark',seed:'#008080',harmonize:false,states:JSON.stringify(config)}[n]));}
   else{
    const c=JSON.parse(Zotero.Prefs.get(key+'states',true));
    check('confirm resets theme seed tint '+enabled,Zotero.Prefs.get(key+'theme',true)==='system'&&Zotero.Prefs.get(key+'seed',true)==='#6750a4'&&Zotero.Prefs.get(key+'harmonize',true)===true);
    check('confirm resets active state configuration '+enabled,c.custom.length===0&&Object.keys(c.overrides).length===0&&c.order.join('|')==='/reading-status/new|/reading-status/to-read|/reading-status/reading|/reading-status/read|/reading-status/unread');
    check('custom identity remains recognized without rewriting item '+enabled,c.retired.some(s=>s.tag===tag)&&JSON.stringify(item.getTags())===before);
    check('settings controls and preview refresh '+enabled,box.querySelector('[data-rs-mode="system"]').getAttribute('aria-checked')==='true'&&box.querySelector('input[type="color"]').value==='#6750a4'&&box.querySelector('.rs-harmonize').checked&&[...box.querySelectorAll('.rs-preview .rs-label')].map(e=>e.textContent).join('|')==='New|To Read|Reading|Finished|UnRead');
    box.querySelector('.rs-settings-header').scrollIntoView({block:'start'});await pause();await snapshot(prefs,report.pluginVersion+'-'+(enabled?'themeFixture':'raw')+'-settings.png');
   }
  }
  prefs.close();prefs=null;
 }
 }catch(e){report.error=String(e);report.stack=e.stack;}
 finally{if(watcher)Services.obs.removeObserver(watcher,'common-dialog-loaded');prefs?.close();for(const [name,value] of Object.entries(old)){if(value===undefined)Zotero.Prefs.clear(key+name,true);else Zotero.Prefs.set(key+name,value,true);}}
 await Zotero.File.putContentsAsync(out+'/reset-report.json',JSON.stringify(report,null,2));Services.startup.quit(Ci.nsIAppStartup.eForceQuit);
}
