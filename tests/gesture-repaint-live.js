export async function run(){
 const out='/tmp/reading-status-live',report={version:Zotero.version,checks:[],cases:[]};
 try{
 const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');report.pluginVersion=(await AddonManager.getAddonByID('reading-status-capsules@independent.local')).version;
 const themeFixture=await AddonManager.getAddonByID('material-theme-md3@zotero-theme.local');if(themeFixture&&!themeFixture.isActive)await themeFixture.enable();
 const win=Zotero.getMainWindow(),doc=win.document,tree=win.ZoteroPane.itemsView;await tree.waitForLoad();Zotero.Prefs.set('extensions.readingStatusCapsules.states',JSON.stringify({order:['/reading-status/reading','/reading-status/to-read','/reading-status/new','/reading-status/read','/reading-status/unread']}),true);
 const collection=new Zotero.Collection();collection.name='Recorded three-row regression';await collection.saveTx();
 const entries=[];await Zotero.DB.executeTransaction(async()=>{for(const [i,state] of [[0,'reading'],[1,'new'],[2,'read']]){const p=new Zotero.Item('journalArticle');p.setField('title','Gesture video fixture '+i);p.addTag('/reading-status/'+state,0);p.addToCollection(collection.id);await p.save();entries.push(p);}});
 await win.ZoteroPane.collectionsView.selectByID('C'+collection.id);await tree.waitForLoad();
 await tree._handleColumnSort(tree._getColumns().findIndex(c=>c.label==='状态'),1);win.focus();await Zotero.Promise.delay(300);
 for(const repaint of Array.from({length:12},(_,i)=>i%2===1)){
 await tree.selectItems([entries[1].id],true);tree.tree.scrollToRow(tree.getRowIndexByID(entries[2].id));await Zotero.Promise.delay(100);
 const original=doc.querySelector(`.rs-capsule[data-rs-row-item="${entries[2].id}"]`),r=original.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
 win.windowUtils.sendMouseEvent('mousedown',x,y,0,1,0);
 if(repaint){tree.invalidateRowCache([entries[2].id]);tree.tree.invalidate();await new Promise(resolve=>win.requestAnimationFrame(resolve));await new Promise(resolve=>win.requestAnimationFrame(resolve));}
 win.windowUtils.sendMouseEvent('mouseup',x,y,0,1,0);await Zotero.Promise.delay(250);
 const pass=!!doc.querySelector('.rs-menu')&&tree.getSelectedItems(true).join(',')===String(entries[2].id);
 report.cases.push({repaint,oldNodeConnected:original.isConnected,selected:tree.getSelectedItems(true),menuOpen:!!doc.querySelector('.rs-menu')});report.checks.push({name:'same source repaint click opens '+repaint,pass});
 const menu=doc.querySelector('.rs-menu');
 if(menu){
  let calls=0;const save=entries[2].saveTx;entries[2].saveTx=async function(...args){calls++;return save.apply(this,args);};
  const target=entries[2].hasTag('/reading-status/reading')?0:2,selected=menu.querySelector('[data-rs-state-tag="/reading-status/'+(target===0?'new':'reading')+'"]'),rect=selected.getBoundingClientRect();
  win.windowUtils.sendMouseEvent('mousedown',rect.x+rect.width/2,rect.y+rect.height/2,0,1,0);win.windowUtils.sendMouseEvent('mouseup',rect.x+rect.width/2,rect.y+rect.height/2,0,1,0);await Zotero.Promise.delay(250);entries[2].saveTx=save;
  report.checks.push({name:'single mouse gesture saves once '+repaint,pass:calls===1&&entries[2].hasTag('/reading-status/'+(target===0?'new':'reading'))});
 }

 }
 // Releasing over a different item must cancel instead of following row reuse.
 const title=doc.querySelector(`.rs-capsule[data-rs-row-item="${entries[1].id}"]`).closest('.row').querySelector('.cell.title').getBoundingClientRect();
 win.windowUtils.sendMouseEvent('mousedown',title.x+title.width/2,title.y+title.height/2,0,1,0);win.windowUtils.sendMouseEvent('mouseup',title.x+title.width/2,title.y+title.height/2,0,1,0);
 tree.tree.scrollToRow(tree.getRowIndexByID(entries[2].id));await Zotero.Promise.delay(150);
 const a=doc.querySelector(`.rs-capsule[data-rs-row-item="${entries[2].id}"]`).getBoundingClientRect();
 const b=doc.querySelector(`.rs-capsule[data-rs-row-item="${entries[1].id}"]`).getBoundingClientRect();
 win.windowUtils.sendMouseEvent('mousedown',a.x+a.width/2,a.y+a.height/2,0,1,0);win.windowUtils.sendMouseEvent('mouseup',b.x+b.width/2,b.y+b.height/2,0,1,0);await Zotero.Promise.delay(150);
 report.checks.push({name:'release on different item cancels',pass:!doc.querySelector('.rs-menu')&&tree.getSelectedItems(true).join(',')===String(entries[1].id)});
 win.windowUtils.sendMouseEvent('mousedown',a.x+a.width/2,a.y+a.height/2,0,1,0);win.windowUtils.sendMouseEvent('mouseup',-5,-5,0,1,0);await Zotero.Promise.delay(150);
 report.checks.push({name:'release outside window cancels',pass:!doc.querySelector('.rs-menu')&&tree.getSelectedItems(true).join(',')===String(entries[1].id)});

 await win.ZoteroPane.collectionsView.selectByID('L'+Zotero.Libraries.userLibraryID);
 }catch(e){report.error=String(e);report.stack=e.stack;}
 await Zotero.File.putContentsAsync(out+'/gesture-repaint-'+report.pluginVersion+'.json',JSON.stringify(report,null,2));Services.startup.quit(Ci.nsIAppStartup.eForceQuit);
}
