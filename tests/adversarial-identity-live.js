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
  for(let step=0;step<24;step++){
   const i=step%3,j=(i+1)%3;
   const tagsBefore=items.map(item=>JSON.stringify(item.getTags()));
   const button=doc.querySelector(`.rs-capsule[data-rs-row-item="${items[i].id}"]`),r=button.getBoundingClientRect();
   win.windowUtils.sendMouseEvent('mousedown',r.x+r.width/2,r.y+r.height/2,0,1,0);
   // Change row order while the physical gesture is still in progress.
   await tree._handleColumnSort(tree._getColumns().findIndex(c=>c.label==='状态'),step%2?1:-1);
   await new Promise(resolve=>win.requestAnimationFrame(resolve));
   win.windowUtils.sendMouseEvent('mouseup',r.x+r.width/2,r.y+r.height/2,0,1,0);
   await Zotero.Promise.delay(180);
   const menu=doc.querySelector('.rs-menu');
   if(menu){
    check('reordered gesture retains original document '+step,tree.getSelectedItems(true).join(',')===String(items[i].id));
    click(menu.querySelector('[data-rs-state-tag="/reading-status/new"]'));
    await Zotero.Promise.delay(180);
    check('reordered gesture only original changes '+step,items.every((item,k)=>k===i||JSON.stringify(item.getTags())===tagsBefore[k]));
   }else check('reordered gesture cancels without writes '+step,items.every((item,k)=>JSON.stringify(item.getTags())===tagsBefore[k]));
   // Begin selecting A, then B without waiting for A's pane rendering.
   const first=doc.querySelector(`.rs-capsule[data-rs-row-item="${items[i].id}"]`);
   const second=doc.querySelector(`.rs-capsule[data-rs-row-item="${items[j].id}"]`);
   first.click();second.click();await Zotero.Promise.delay(180);
   const active=doc.querySelector('.rs-menu');
   const snap=items.map(item=>JSON.stringify(item.getTags()));
   if(active){
    const selected=tree.getSelectedItems(true)[0];
    click(active.querySelector('[data-rs-state-tag="/reading-status/unread"]'));await Zotero.Promise.delay(180);
    check('competing selection edits selected document only '+step,items.every((item,k)=>item.id===selected||JSON.stringify(item.getTags())===snap[k]));
    check('latest capsule activation wins '+step,selected===items[j].id);
   }else check('competing activation cancels without writes '+step,items.every((item,k)=>JSON.stringify(item.getTags())===snap[k]));
  }
 }catch(e){report.error=String(e);report.stack=e.stack;}
 await Zotero.File.putContentsAsync(out+'/adversarial-identity-'+report.pluginVersion+'.json',JSON.stringify(report,null,2));Services.startup.quit(Ci.nsIAppStartup.eForceQuit);
}
