// Timing and repaint evidence in a real isolated Zotero process.
export async function run(){
 const out='/tmp/reading-status-live',report={version:Zotero.version,samples:[],checks:[]};
 let restore=()=>{};
 try{
 const win=Zotero.getMainWindow(),doc=win.document,tree=win.ZoteroPane.itemsView;await tree.waitForLoad();
 const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');report.pluginVersion=(await AddonManager.getAddonByID('reading-status-capsules@independent.local')).version;
 const themeFixture=await AddonManager.getAddonByID('material-theme-md3@zotero-theme.local');if(themeFixture&&!themeFixture.isActive)await themeFixture.enable();report.themeFixture=themeFixture?.isActive;
 Zotero.Prefs.set('extensions.readingStatusCapsules.states','{}',true);
 const p=new Zotero.Item('journalArticle');p.setField('title','Performance fixture');for(let i=0;i<100;i++)p.addTag('Performance other tag '+i,0);await p.saveTx();
 const pdf=new Zotero.Item('attachment');pdf.parentItemID=p.id;pdf.attachmentLinkMode=Zotero.Attachments.LINK_MODE_LINKED_FILE;pdf.attachmentContentType='application/pdf';pdf.attachmentPath=out+'/fixture.pdf';await pdf.saveTx();
 const stateTags=['new','to-read','reading','read','unread'].map(t=>'/reading-status/'+t);
 const find=()=>doc.querySelector(`.rs-capsule[data-rs-row-item="${pdf.id}"]`);
 const pause=ms=>Zotero.Promise.delay(ms);
 for(const sorted of [false,true]){
 const index=tree._getColumns().findIndex(c=>sorted ? c.label==='状态' : c.dataKey==='title');await tree._handleColumnSort(index,1);await tree.selectItems([pdf.id],true);await pause(300);
 report.rowCount=tree._rows.length;
 let counters,txEnd,txStart,currentStart,lag=0,last=win.performance.now();
 const tick=win.setInterval(()=>{const now=win.performance.now();lag=Math.max(lag,now-last-20);last=now;},20);
 const inv=tree.tree.invalidate,rowInv=tree.tree.invalidateRow,save=p.saveTx;
 tree.tree.invalidate=function(...args){counters&&(counters.full++);return inv.apply(this,args);};
 tree.tree.invalidateRow=function(...args){counters&&(counters.row++);return rowInv.apply(this,args);};
 p.saveTx=async function(...args){txStart=win.performance.now();const v=await save.apply(this,args);txEnd=win.performance.now();return v;};
 restore=()=>{tree.tree.invalidate=inv;tree.tree.invalidateRow=rowInv;p.saveTx=save;win.clearInterval(tick);};
 for(const state of [1,2,3,4,0,2]){
 await tree.selectItems([pdf.id],true);await pause(100);const button=find();button.click();
 for(let i=0;i<100&&!doc.querySelector('.rs-menu');i++)await pause(10);
 const menu=doc.querySelector('.rs-menu');if(!menu)throw Error('No menu');counters={full:0,row:0};txStart=txEnd=undefined;lag=0;last=win.performance.now();currentStart=win.performance.now();menu.querySelectorAll('button')[state].click();const immediateMenuClosed=!doc.querySelector('.rs-menu');const menuCloseMS=immediateMenuClosed?win.performance.now()-currentStart:null;
 for(let i=0;i<3000&&(!txEnd||doc.querySelector('.rs-menu'));i++)await pause(10);
 const done=win.performance.now();await pause(150);
 const correct=p.hasTag(stateTags[state])&&tree.getSelectedItems(true).join(',')===String(pdf.id)&&p.getTags().filter(t=>t.tag.startsWith('Performance other tag ')).length===100;
 report.checks.push({name:'save preserves parent tags and selected PDF '+sorted+' '+state,pass:correct});
 report.samples.push({sorted,state,transactionMS:txEnd-txStart,clickToReadyMS:done-currentStart,maxTimerLagMS:lag,immediateMenuClosed,menuCloseMS,...counters});
 if(!correct)throw Error('Incorrect state/selection');
 }
 restore();restore=()=>{};
 }
 }catch(e){report.error=String(e);report.stack=e.stack;}
 finally{restore();}
 await Zotero.File.putContentsAsync(out+'/performance-'+(report.pluginVersion||'error')+'.json',JSON.stringify(report,null,2));Services.startup.quit(Ci.nsIAppStartup.eForceQuit);
}
