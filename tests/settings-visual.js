// Actual Zotero settings visual QA, isolated profile only; no library writes.
export async function run() {
 const output='/tmp/reading-status-live',report={version:Zotero.version,checks:[],screenshots:[]};
 const check=(name,result)=>{report.checks.push({name,pass:!!result});if(!result)throw Error(name);};
 const delay=()=>Zotero.Promise.delay(350);
 let prefs,original;
 try {
  const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
  report.pluginVersion=(await AddonManager.getAddonByID('reading-status-capsules@independent.local')).version;
  original=Zotero.Prefs.get('extensions.readingStatusCapsules.states',true)||'{}';
  const themeFixture=await AddonManager.getAddonByID('material-theme-md3@zotero-theme.local');
  for(const enabled of [false,true]) {
   if(themeFixture){if(enabled&&!themeFixture.isActive)await themeFixture.enable();if(!enabled&&themeFixture.isActive)await themeFixture.disable();}
   await delay();prefs=Zotero.Utilities.Internal.openPreferences('reading-status-capsules-settings');
   for(let i=0;i<50&&!prefs.document.querySelector('.rs-status-row button');i++)await Zotero.Promise.delay(100);
   const doc=prefs.document,box=doc.querySelector('.rs-settings');
   check('all reorder buttons are accessible triangle icons '+enabled,[...box.querySelectorAll('.rs-status-editor button:not([aria-label^="删除状态"])')].every(b=>b.querySelector('svg path')&&!b.textContent.trim()&&b.title&&b.getAttribute('aria-label')));
   check('add button is an accessible plus icon '+enabled,box.querySelector('.rs-add-status button svg path')&&box.querySelector('.rs-add-status button').getAttribute('aria-label')==='添加状态');
   const modes=[...box.querySelectorAll('[data-rs-mode]')];
   check('wide single choice theme group '+enabled,modes.length===3&&box.querySelector('.rs-theme-options').getBoundingClientRect().width>box.getBoundingClientRect().width*.8);
   for(const mode of ['light','dark','system']){modes.find(b=>b.dataset.rsMode===mode).click();await delay();check('theme choice saves '+enabled+' '+mode,Zotero.Prefs.get('extensions.readingStatusCapsules.theme',true)===mode&&modes.filter(b=>b.getAttribute('aria-checked')==='true').length===1);}
   modes[2].dispatchEvent(new prefs.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));await delay();check('theme keyboard selection '+enabled,modes[1].getAttribute('aria-checked')==='true'&&doc.activeElement===modes[1]);
   const seed=box.querySelector('.rs-seed'),toggle=box.querySelector('.rs-harmonize');seed.value='#006b59';seed.dispatchEvent(new prefs.Event('input',{bubbles:true}));toggle.click();await delay();check('seed and tint save '+enabled,Zotero.Prefs.get('extensions.readingStatusCapsules.seed',true)==='#006b59'&&Zotero.Prefs.get('extensions.readingStatusCapsules.harmonize',true)===toggle.checked);
   const a=seed.getBoundingClientRect(),b=toggle.closest('label').getBoundingClientRect();check('seed and tint share row '+enabled,Math.abs((a.top+a.height/2)-(b.top+b.height/2))<2);
   check('reset is last and square with centered text '+enabled,box.lastElementChild.classList.contains('rs-settings-footer')&&parseFloat(prefs.getComputedStyle(box.querySelector('.rs-reset')).borderRadius)===8&&prefs.getComputedStyle(box.querySelector('.rs-reset')).textAlign==='center');
   const firstTag=box.querySelector('.rs-status-row').dataset.rsTag;
   box.querySelector('.rs-status-editor .rs-status-row [title="下移"]').click();await delay();
   check('down triangle reorders '+enabled,box.querySelectorAll('.rs-status-editor .rs-status-row')[1].dataset.rsTag===firstTag);
   box.querySelectorAll('.rs-status-editor .rs-status-row')[1].querySelector('button').click();await delay();
   check('up triangle reorders '+enabled,box.querySelector('.rs-status-row').dataset.rsTag===firstTag);
   box.querySelector('.rs-new-label').value='视觉测试';box.querySelector('.rs-add-status button').click();await delay();
   check('plus button adds state '+enabled,[...box.querySelectorAll('.rs-status-editor input[type="text"]')].some(b=>b.value==='视觉测试'));
   Zotero.Prefs.set('extensions.readingStatusCapsules.states',original,true);await delay();
   for(const [width,mode] of [[900,'dark'],[640,'light']]){
    prefs.resizeTo(width,800);box.querySelector('[data-rs-mode="'+mode+'"]').click();await delay();
    report.windowSizes||=[];report.windowSizes.push({requestedWidth:width,actualWidth:prefs.innerWidth,actualHeight:prefs.innerHeight,mode,themeFixture:enabled});
    box.querySelector('.rs-settings-header').scrollIntoView({block:'start'});await delay();
    const controls=[...box.querySelectorAll('.rs-add-status input, .rs-add-status button')].map(e=>e.getBoundingClientRect());
    check('add controls occupy one row '+enabled+' '+width,controls.every(r=>Math.abs((r.top+r.height/2)-(controls[0].top+controls[0].height/2))<1));
    const canvas=doc.createElementNS('http://www.w3.org/1999/xhtml','canvas');canvas.width=prefs.innerWidth;canvas.height=prefs.innerHeight;
    const snap=await prefs.browsingContext.currentWindowGlobal.drawSnapshot(new prefs.DOMRect(0,0,canvas.width,canvas.height),1,'rgb(255,255,255)');canvas.getContext('2d').drawImage(snap,0,0);snap.close();
    const name=report.pluginVersion+'-'+(enabled?'themeFixture':'raw')+'-'+mode+'-settings.png';await prefs.IOUtils.write(output+'/'+name,Uint8Array.from(prefs.atob(canvas.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0)));report.screenshots.push(name);
    box.querySelector('.rs-reset').scrollIntoView({block:'end'});await delay();
    const bottom=await prefs.browsingContext.currentWindowGlobal.drawSnapshot(new prefs.DOMRect(0,0,canvas.width,canvas.height),1,'rgb(255,255,255)');canvas.getContext('2d').drawImage(bottom,0,0);bottom.close();const footer=name.replace('-settings.png','-footer.png');await prefs.IOUtils.write(output+'/'+footer,Uint8Array.from(prefs.atob(canvas.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0)));report.screenshots.push(footer);
   }
   prefs.close();prefs=null;
  }
 }catch(e){report.error=String(e);report.stack=e.stack;}
 finally{prefs?.close();if(original)Zotero.Prefs.set('extensions.readingStatusCapsules.states',original,true);}
 await Zotero.File.putContentsAsync(output+'/settings-report.json',JSON.stringify(report,null,2));Services.startup.quit(Ci.nsIAppStartup.eForceQuit);
}
