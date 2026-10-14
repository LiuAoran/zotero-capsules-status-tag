export async function run(){
 const out='/tmp/reading-status-live',report={version:Zotero.version,checks:[],samples:[]};
 try{
 const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');report.pluginVersion=(await AddonManager.getAddonByID('reading-status-capsules@independent.local')).version;
 const themeFixture=await AddonManager.getAddonByID('material-theme-md3@zotero-theme.local');if(themeFixture&&!themeFixture.isActive)await themeFixture.enable();
 const win=Zotero.getMainWindow(),doc=win.document,tree=win.ZoteroPane.itemsView;await tree.waitForLoad();
 Zotero.Prefs.set('extensions.readingStatusCapsules.states','{}',true);
 const tags=['new','to-read','reading','read','unread'].map(t=>'/reading-status/'+t);
 const parents=[],pdfs=[];
 await Zotero.DB.executeTransaction(async()=>{
 for(let i=0;i<12;i++){const p=new Zotero.Item('journalArticle');p.setField('title','Sort regression '+i);p.addTag(tags[i%5],0);await p.save();parents.push(p);
 const pdf=new Zotero.Item('attachment');pdf.parentItemID=p.id;pdf.attachmentLinkMode=Zotero.Attachments.LINK_MODE_LINKED_FILE;pdf.attachmentContentType='application/pdf';pdf.attachmentPath=out+'/fixture.pdf';await pdf.save();pdfs.push(pdf);}
 });await Zotero.Promise.delay(300);
 const col=tree._getColumns().findIndex(c=>c.label==='状态');
 for(const direction of [1,-1]){
 await tree._handleColumnSort(col,direction);
 for(const [i,state] of [[1,4],[1,0],[4,3],[4,1],[8,2],[8,4]]){
 const source=pdfs[i];await tree.selectItems([source.id],true);tree.tree.scrollToRow(tree.getRowIndexByID(source.id));await Zotero.Promise.delay(100);
 const b=doc.querySelector(`.rs-capsule[data-rs-row-item="${source.id}"]`);const r=b.getBoundingClientRect();const beforeTop=r.top;win.windowUtils.sendMouseEvent('mousedown',r.x+r.width/2,r.y+r.height/2,0,1,0);win.windowUtils.sendMouseEvent('mouseup',r.x+r.width/2,r.y+r.height/2,0,1,0);
 for(let t=0;t<100&&!doc.querySelector('.rs-menu');t++)await Zotero.Promise.delay(10);
 const option=doc.querySelectorAll('.rs-menu button')[state],o=option.getBoundingClientRect();win.windowUtils.sendMouseEvent('mousedown',o.right-8,o.y+o.height/2,0,1,0);win.windowUtils.sendMouseEvent('mouseup',o.right-8,o.y+o.height/2,0,1,0);
 await Zotero.Promise.delay(250);const selected=tree.getSelectedItems(true);
 const ranks=tree._rows.filter(r=>r.ref?.isRegularItem()).map(r=>{const own=r.ref.getTags().map(t=>t.tag);return [2,1,3,4,0].find(j=>own.includes(tags[j]))??0;});
 const afterButton=doc.querySelector(`.rs-capsule[data-rs-row-item="${source.id}"]`);const afterTop=afterButton?.getBoundingClientRect().top;
 const viewport=afterButton?.closest('.virtualized-table-body');const clamped=viewport && (viewport.scrollTop<=1||viewport.scrollTop>=viewport.scrollHeight-viewport.clientHeight-1);
 const ordered=ranks.every((v,j)=>!j||direction*(v-ranks[j-1])>=0);
 report.samples.push({direction,sourceID:source.id,parentID:parents[i].id,selected,ordered,beforeTop,afterTop,viewportTop:viewport?.getBoundingClientRect().top,scrollTop:viewport?.scrollTop,clamped,focusSource:doc.activeElement?.dataset?.rsRowItem});
 report.checks.push({name:'source selected '+direction+' '+i+' '+state,pass:selected.length===1&&selected[0]===source.id});
 report.checks.push({name:'stable screen position '+direction+' '+i+' '+state,pass:clamped||Math.abs(beforeTop-afterTop)<2});
 report.checks.push({name:'global order '+direction+' '+i+' '+state,pass:ordered});
 }
 }
 }catch(e){report.error=String(e);report.stack=e.stack;}
 await Zotero.File.putContentsAsync(out+'/sorted-selection-'+report.pluginVersion+'.json',JSON.stringify(report,null,2));Services.startup.quit(Ci.nsIAppStartup.eForceQuit);
}
