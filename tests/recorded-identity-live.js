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
  for(const [step,[i,status]] of [[1,'reading'],[0,'read'],[2,'new'],[0,'unread'],[1,'reading'],[1,'to-read'],[2,'read'],[0,'read'],[0,'to-read']].entries()){
   const clicked=doc.querySelector(`.rs-capsule[data-rs-row-item="${items[i].id}"]`);
   const before=items.map(item=>JSON.stringify(item.getTags()));
   const screen=clicked.getBoundingClientRect();const visibleRow=tree.getRow(Number(clicked.closest('.row').id.match(/-row-(\d+)$/)[1])).ref;
   check('displayed title is click target '+step,visibleRow.id===items[i].id);
   click(clicked);
   for(let t=0;t<100&&!doc.querySelector('.rs-menu');t++)await Zotero.Promise.delay(10);
   const option=doc.querySelector(`.rs-menu [data-rs-state-tag="/reading-status/${status}"]`);
   if(!option)throw new Error('Menu missing at step '+step);
   check('menu selected clicked source '+step,tree.getSelectedItems(true).join(',')===String(items[i].id));
   click(option);expected[i]=status;
   const samples=[];
   for(const delay of [0,16,32,100,300]){
    await Zotero.Promise.delay(delay);
    samples.push({delay,rows:Array.from(doc.querySelectorAll('.row')).filter(r=>r.querySelector('.rs-capsule')).map(r=>({row:r.id,title:r.querySelector('.cell.title')?.textContent,text:r.querySelector('.rs-label')?.textContent,sourceID:r.querySelector('.rs-capsule')?.dataset.rsRowItem,hostID:tree.getRow(Number(r.id.match(/-row-(\d+)$/)?.[1]))?.ref?.id}))});
   }
   const rows=items.map((item,j)=>{const b=doc.querySelector(`.rs-capsule[data-rs-row-item="${item.id}"]`);return {id:item.id,title:item.getField('title'),tags:item.getTags(),label:b?.querySelector('.rs-label').textContent};});
   for(let j=0;j<items.length;j++){
    check('stored document state '+step+' '+j,items[j].hasTag('/reading-status/'+expected[j]));
    check('visible document state '+step+' '+j,rows[j].label===labels[expected[j]]);
    if(j!==i)check('unrelated document untouched '+step+' '+j,JSON.stringify(items[j].getTags())===before[j]);
   }
   report.steps.push({step,clickedID:items[i].id,clickedTitle:items[i].getField('title'),requested:status,screen,rows,samples});
  }
 }catch(e){report.error=String(e);report.stack=e.stack;}
 await Zotero.File.putContentsAsync(out+'/recorded-identity-'+report.pluginVersion+'.json',JSON.stringify(report,null,2));Services.startup.quit(Ci.nsIAppStartup.eForceQuit);
}
