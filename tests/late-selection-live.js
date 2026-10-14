// Replay the recording's sequence and verify every document, not just selection.
export async function run(){
 const out='/tmp/reading-status-live',report={checks:[],steps:[]};
 const check=(name,pass)=>report.checks.push({name,pass});
 try{
  const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
  report.pluginVersion=(await AddonManager.getAddonByID('reading-status-capsules@independent.local')).version;
  const win=Zotero.getMainWindow(),doc=win.document,tree=win.ZoteroPane.itemsView;
  await tree.waitForLoad();
  Zotero.Prefs.set('extensions.readingStatusCapsules.states',JSON.stringify({order:['/reading-status/reading','/reading-status/to-read','/reading-status/new','/reading-status/read','/reading-status/unread']}),true);
  const collection=new Zotero.Collection();collection.name='Recording document identity';await collection.saveTx();
  const items=[];
  for(const [name,status] of [['Piece of Table','to-read'],['TAP4LLM','to-read'],['Tables as Tests','read']]){
   const item=new Zotero.Item('journalArticle');item.setField('title',name);item.addTag('/reading-status/'+status,0);item.addToCollection(collection.id);await item.saveTx();items.push(item);
  }
  await win.ZoteroPane.collectionsView.selectByID('C'+collection.id);await tree.waitForLoad();
  await tree._handleColumnSort(tree._getColumns().findIndex(c=>c.label==='状态'),1);win.focus();await Zotero.Promise.delay(300);
  const labels={'new':'New','to-read':'To Read','reading':'Reading','read':'Finished','unread':'UnRead'};
  const expected=['to-read','to-read','read'];
  const click=node=>{const r=node.getBoundingClientRect();win.windowUtils.sendMouseEvent('mousedown',r.x+r.width/2,r.y+r.height/2,0,1,0);win.windowUtils.sendMouseEvent('mouseup',r.x+r.width/2,r.y+r.height/2,0,1,0);};
  for(const phase of ['menu','after-save','slow-save','new-user-input','keyboard-input']){
   const a=items[0],b=items[1];a.setTags([{tag:'/reading-status/to-read',type:0}]);b.setTags([{tag:'/reading-status/new',type:0}]);await a.saveTx();await b.saveTx();await Zotero.Promise.delay(120);
   await tree.selectItems([a.id],true,true);const staleSelection=tree.getSelectedObjects();
   click(doc.querySelector(`.rs-capsule[data-rs-row-item="${b.id}"]`));
   for(let t=0;t<100&&!doc.querySelector('.rs-menu');t++)await Zotero.Promise.delay(10);
   const menu=doc.querySelector('.rs-menu');if(!menu)throw new Error('Menu missing');
   check('B selected when its menu opens '+phase,tree.getSelectedItems(true).join(',')===String(b.id));
   if(phase==='menu'){await tree._restoreSelection(staleSelection,false,false);await Zotero.Promise.delay(80);}
   const realSave=b.saveTx;
   if(phase==='slow-save')b.saveTx=async function(...args){await Zotero.Promise.delay(180);return realSave.apply(this,args);};
   click(menu.querySelector('[data-rs-state-tag="/reading-status/reading"]'));
   await Zotero.Promise.delay(100);
   if(phase==='after-save'||phase==='slow-save'){await tree._restoreSelection(staleSelection,false,false);}
   if(phase==='new-user-input'){
    const title=doc.querySelector(`.rs-capsule[data-rs-row-item="${a.id}"]`).closest('.row').querySelector('.cell.title');click(title);
   }
   if(phase==='keyboard-input'){
    const capsule=doc.querySelector(`.rs-capsule[data-rs-row-item="${b.id}"]`);capsule.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowDown',keyCode:40,bubbles:true,cancelable:true}));
   }
   await Zotero.Promise.delay(250);b.saveTx=realSave;
   check('only clicked B changes '+phase,b.hasTag('/reading-status/reading')&&a.hasTag('/reading-status/to-read'));
   check('selection follows latest user intent '+phase,tree.getSelectedItems(true).join(',')===String(['new-user-input','keyboard-input'].includes(phase)?a.id:b.id));
   report.steps.push({phase,selected:tree.getSelectedItems(true),a:a.getTags(),b:b.getTags()});
   await Zotero.Promise.delay(700);
   await tree._restoreSelection(staleSelection,false,false);await Zotero.Promise.delay(80);
   check('guard expires after settling '+phase,tree.getSelectedItems(true).join(',')===String(a.id));
  }
  // An older save finishing must not expire a newer, still-open menu's guard.
  const a=items[0],b=items[1],original=a.saveTx;
  a.saveTx=async function(...args){await Zotero.Promise.delay(150);return original.apply(this,args);};
  click(doc.querySelector(`.rs-capsule[data-rs-row-item="${a.id}"]`));await Zotero.Promise.delay(120);
  click(doc.querySelector('.rs-menu [data-rs-state-tag="/reading-status/unread"]'));
  const stale=tree.getSelectedObjects();
  click(doc.querySelector(`.rs-capsule[data-rs-row-item="${b.id}"]`));await Zotero.Promise.delay(900);a.saveTx=original;
  const newer=doc.querySelector('.rs-menu');check('new menu survives older save completion',!!newer);
  await tree._restoreSelection(stale,false,false);await Zotero.Promise.delay(80);
  check('old save cannot expire newer menu selection guard',tree.getSelectedItems(true).join(',')===String(b.id));
  const abandoned=newer;newer.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  click(doc.querySelector(`.rs-capsule[data-rs-row-item="${a.id}"]`));await Zotero.Promise.delay(160);
  const latest=doc.querySelector('.rs-menu'),before=items.map(item=>JSON.stringify(item.getTags()));
  abandoned.querySelector('[data-rs-state-tag="/reading-status/new"]').click();await Zotero.Promise.delay(80);
  check('detached menu cannot save or close new menu',doc.querySelector('.rs-menu')===latest&&items.every((item,i)=>JSON.stringify(item.getTags())===before[i]));
  latest.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
 }catch(e){report.error=String(e);report.stack=e.stack;}
 await Zotero.File.putContentsAsync(out+'/late-selection-'+report.pluginVersion+'.json',JSON.stringify(report,null,2));Services.startup.quit(Ci.nsIAppStartup.eForceQuit);
}
