import { STATES, stateOf, saveStatus, configure, sortRank } from '../src/model.js';
export async function run() {
 const output='/tmp/reading-status-live';const report={version:Zotero.version,tests:[],screenshots:[]};
 report.menuTrace=[];const originalDebug=Zotero.debug;Zotero.debug=function(message,...args){if(typeof message==='string'&&message.startsWith('Reading Status menu'))report.menuTrace.push({message,time:Date.now()});return originalDebug.call(Zotero,message,...args);};
 const check=(name,fn)=> {report.tests.push({name,pass:!!fn});if(!fn)throw Error(name)};
 const pause=()=>Zotero.Promise.delay(500);
 try {
  let win; for(let i=0;i<100;i++){win=Zotero.getMainWindow();if(win?.ZoteroPane?.itemsView)break;await Zotero.Promise.delay(200);}
  const tree=win.ZoteroPane.itemsView;await tree.waitForLoad();
  await win.ZoteroPane.collectionsView.selectByID('L'+Zotero.Libraries.userLibraryID);await tree.waitForLoad();
  const previousConfig=Zotero.Prefs.get('extensions.readingStatusCapsules.states',true);
  if(previousConfig && JSON.parse(previousConfig).custom?.some(s=>s.label==='Review')){const c=configure(JSON.parse(previousConfig));check('restart restores custom state and order',STATES.some(s=>s.label==='复核')&&c.order[0]===STATES.find(s=>s.label==='复核').tag);}
  if(previousConfig && JSON.parse(previousConfig).retired?.length){configure(JSON.parse(previousConfig));check('restart preserves deleted state recognition',STATES.some(s=>s.retired&&s.label==='删除测试'));}
  Zotero.Prefs.set('extensions.readingStatusCapsules.states','{}',true);configure();await pause();
  report.withThemeFixture=!!(await win.IOUtils.exists(output+'/enable-theme-fixture'));
  if(!report.withThemeFixture){ const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');const v=await AddonManager.getAddonByID('material-theme-md3@zotero-theme.local');if(v?.isActive){await v.disable();await Zotero.Promise.delay(600);} }
  if(report.withThemeFixture){ const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');let v=await AddonManager.getAddonByID('material-theme-md3@zotero-theme.local');if(!v){const install=await AddonManager.getInstallForFile(Zotero.File.pathToFile(output+'/theme-fixture.xpi'));await install.install();v=await AddonManager.getAddonByID('material-theme-md3@zotero-theme.local');}else if(!v.isActive)await v.enable();await Zotero.Promise.delay(1000);report.themeFixtureVersion=v.version;check('theme compatibility fixture is active',v.isActive); }

  if (await win.IOUtils.exists(output+'/item-id.txt')) { const previous=Zotero.Items.get(Number(await Zotero.File.getContentsAsync(output+'/item-id.txt'))); check('restart restores persisted To Read',stateOf(previous)===1); }
  const p=new Zotero.Item('journalArticle');p.setField('title','Reading Status independent test — long title for compact column');p.setField('publicationTitle','Test Library');await p.saveTx();
  await tree.selectItem(p.id);await pause();
  const find=()=> [...win.document.querySelectorAll('.rs-capsule')].find(b=>b.dataset.rsItem===String(p.id)&&b.getAttribute('aria-label')==='状态: '+STATES[stateOf(p)].label);
  check('default New has no stored status tag',stateOf(p)===0 && p.getTags().length===0);
  check('column is visible',!!find());
  // Dispatch through Gecko's input pipeline, including default focus behavior.
  const nativeClick=button=>{const r=button.getBoundingClientRect();win.windowUtils.sendMouseEvent('mousedown',r.x+r.width/2,r.y+r.height/2,0,1,0);win.windowUtils.sendMouseEvent('mouseup',r.x+r.width/2,r.y+r.height/2,0,1,0);};
  win.focus();await pause();
  report.pluginVersion=(await ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs').AddonManager.getAddonByID('reading-status-capsules@independent.local')).version;
  report.mouseTrace=[];const trace=e=>report.mouseTrace.push({type:e.type,target:e.target?.className?.baseVal??e.target?.className,phase:e.eventPhase});
  for(const type of ['mousedown','mouseup','click','blur','focus'])win.addEventListener(type,trace,true);
  nativeClick(find());await pause();
  for(const type of ['mousedown','mouseup','click','blur','focus'])win.removeEventListener(type,trace,true);
  check('Gecko mouse input opens capsule menu',!!win.document.querySelector('.rs-menu'));
  nativeClick(win.document.querySelectorAll('.rs-menu button')[2]);await pause();check('Gecko mouse input selects Reading',stateOf(p)===2);
  // A popup overlays other rows: a late/extra mouseup must not select them.
  find().click();await pause();
  const ghostOption=win.document.querySelectorAll('.rs-menu button')[1];const ghostRect=ghostOption.getBoundingClientRect();
  const gx=ghostRect.right-8,gy=ghostRect.top+ghostRect.height/2;
  win.windowUtils.sendMouseEvent('mousedown',gx,gy,0,1,0);win.windowUtils.sendMouseEvent('mouseup',gx,gy,0,1,0);await pause();
  check('popup save retains selected item before extra mouseup',tree.getSelectedItems(true).join(',')===String(p.id));
  win.windowUtils.sendMouseEvent('mouseup',gx,gy,0,1,0);await pause();
  check('extra mouseup cannot jump to underlying previous row',tree.getSelectedItems(true).join(',')===String(p.id));
  find().click();await pause();
  const held=win.document.querySelectorAll('.rs-menu button')[2],hr=held.getBoundingClientRect();
  win.windowUtils.sendMouseEvent('mousedown',hr.right-8,hr.top+hr.height/2,0,1,0);
  find().closest('.virtualized-table-body').dispatchEvent(new win.Event('scroll'));await Zotero.Promise.delay(30);
  win.windowUtils.sendMouseEvent('mouseup',hr.right-8,hr.top+hr.height/2,0,1,0);await pause();
  check('menu close during mouse press cannot click through to another row',tree.getSelectedItems(true).join(',')===String(p.id));
  for(let i=0;i<5;i++) {
   const b=find();b.click();await pause();
   const menu=win.document.querySelector('.rs-menu');check('menu '+STATES[i].label,menu?.querySelectorAll('button').length===5);
   menu.querySelectorAll('button')[i].click();await pause();
   check('save '+STATES[i].label,stateOf(p)===i&&p.getTags().filter(t=>t.tag.startsWith('/reading-status/')).length===1);
  }
  await Zotero.UndoHistory.undo();await pause();check('real Zotero undo',stateOf(p)===3);
  await Zotero.UndoHistory.redo();await pause();check('real Zotero redo',stateOf(p)===4);
  find().click();await pause();win.document.querySelector('.rs-menu button').dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));check('Escape cancels menu',!win.document.querySelector('.rs-menu')&&stateOf(p)===4);
  p.addTag('/reading-status/reading',0);await p.saveTx();await pause();check('external conflict updates display',stateOf(p)===2&&!!find());
  await saveStatus(p,1);await pause();check('manual choice removes conflicts',p.getTags().length===1&&stateOf(p)===1);
  const notes=new Zotero.Item('note');notes.parentItemID=p.id;notes.setNote('Temporary note');await notes.saveTx();
  const pdf=new Zotero.Item('attachment');pdf.parentItemID=p.id;pdf.attachmentLinkMode=Zotero.Attachments.LINK_MODE_LINKED_FILE;pdf.attachmentContentType='application/pdf';pdf.attachmentPath='/tmp/reading-status-live/fixture.pdf';await pdf.saveTx();
  if(!tree.isContainerOpen(tree.getRowIndexByID(p.id)))await tree.toggleOpenState(tree.getRowIndexByID(p.id));await pause();tree.tree.scrollToRow(tree.getRowIndexByID(pdf.id));await pause();
  check('PDF parent status renders, note blank',win.document.querySelectorAll('[data-rs-item="'+p.id+'"]').length===2);
  tree.selection.select(tree.getRowIndexByID(notes.id));await pause();
  const selectedNote=tree.getSelectedItems(true).join(',');
  let parentButton=find();let rect=parentButton.getBoundingClientRect();
  win.windowUtils.sendMouseEvent('mousedown',rect.right-8,rect.y+rect.height/2,0,1,0);
  win.windowUtils.sendMouseEvent('mouseup',rect.right-8,rect.y+rect.height/2,0,1,0);await pause();
  check('mouse arrow opens unselected parent capsule',!!win.document.querySelector('.rs-menu'));
  check('mouse click selects parent instead of old note',tree.getSelectedItems(true).join(',')===String(p.id));
  const focusedOption=win.document.querySelector('.rs-menu button');
  focusedOption.dispatchEvent(new win.FocusEvent('blur',{relatedTarget:win.document.querySelectorAll('.rs-menu button')[2]}));
  check('control blur does not dismiss menu',!!win.document.querySelector('.rs-menu'));
  tree.tree.invalidate();await pause();check('row repaint retains open menu',!!win.document.querySelector('.rs-menu'));
  win.dispatchEvent(new win.Event('resize'));await pause();check('layout resize retains open menu',!!win.document.querySelector('.rs-menu'));
  win.document.querySelector('#zotero-item-pane')?.dispatchEvent(new win.Event('scroll'));await pause();check('item pane scroll does not dismiss status menu',!!win.document.querySelector('.rs-menu'));
  check('replacement capsule has expanded state',find().getAttribute('aria-expanded')==='true');
  win.document.querySelector('.rs-menu button').dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  const pdfButton=win.document.querySelectorAll('[data-rs-item="'+p.id+'"]').item(1);
  nativeClick(pdfButton);await pause();check('mouse PDF capsule opens',!!win.document.querySelector('.rs-menu'));
  nativeClick(win.document.querySelectorAll('.rs-menu button')[3]);await pause();check('mouse PDF saves parent only',stateOf(p)===3&&pdf.getTags().length===0);
  await saveStatus(p,1);await pause();

  const cols=tree._getColumns().filter(c=>!c.hidden).sort((a,b)=>a.ordinal-b.ordinal);const ci=cols.findIndex(c=>c.label==='状态');check('column follows title',ci===cols.findIndex(c=>c.dataKey==='title')+1);
  // Exercise keyboard focus and selection with actual rendered controls.
  const key=(el,key)=>el.dispatchEvent(new win.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
  find().focus();key(find(),'Enter');await pause();let mb=win.document.querySelectorAll('.rs-menu button');
  check('keyboard opens and focuses current state',win.document.activeElement===mb[1]);
  key(mb[1],'ArrowDown');check('ArrowDown advances focus',win.document.activeElement===mb[2]);key(mb[2],'Enter');await pause();check('keyboard Enter commits Reading',stateOf(p)===2);check('keyboard commit returns focus to capsule',win.document.activeElement?.dataset?.rsItem===String(p.id));
  find().focus();key(find(),' ');await pause();check('Space opens menu',!!win.document.querySelector('.rs-menu'));win.document.documentElement.dispatchEvent(new win.Event('pointerdown',{bubbles:true}));check('outside click cancels',!win.document.querySelector('.rs-menu')&&stateOf(p)===2);
  const a=tree.getRowIndexByID(p.id), n=tree.getRowIndexByID(notes.id);tree.selection.select(a);tree.selection.toggleSelect(n);await pause();
  const selection=tree.getSelectedItems(true).slice().sort().join(',');find().click();await pause();win.document.querySelector('.rs-menu button').click();await pause();check('capsule selects clicked item without bulk editing',tree.getSelectedItems(true).join(',')===String(p.id));
  tree.tree.scrollToRow(tree.getRowIndexByID(pdf.id));await pause();const childButtons=win.document.querySelectorAll('[data-rs-item="'+p.id+'"]');childButtons[childButtons.length-1].click();await pause();
  const childMenu=win.document.querySelector('.rs-menu'),childAnchor=win.document.querySelector('.rs-capsule[aria-expanded="true"]');
  childAnchor.closest('.virtualized-table-body').dispatchEvent(new win.Event('scroll'));await Zotero.Promise.delay(30);check('programmatic list scroll keeps source menu open',childMenu===win.document.querySelector('.rs-menu'));
  childAnchor.closest('.virtualized-table-body').dispatchEvent(new win.WheelEvent('wheel',{bubbles:true,deltaY:50}));await Zotero.Promise.delay(30);check('user list wheel dismisses menu',!win.document.querySelector('.rs-menu'));
  win.document.querySelector(`.rs-capsule[data-rs-row-item="${pdf.id}"]`).click();await pause();win.document.querySelectorAll('.rs-menu button')[3].click();await pause();check('PDF edit changes parent only',stateOf(p)===3&&pdf.getTags().length===0);
  const editable=p.isEditable;p.isEditable=()=>false;tree._rowCache={};tree.tree.invalidate();await pause();check('injected read-only UI disabled',find().getAttribute('aria-disabled')==='true');find().click();await pause();check('read-only cannot open menu',!win.document.querySelector('.rs-menu'));p.isEditable=editable;tree._rowCache={};tree.tree.invalidate();await pause();
  const delayedSave=p.saveTx;let release;const gate=new Promise(resolve=>{release=resolve;});
  p.saveTx=async function(...args){await gate;return delayedSave.apply(this,args);};
  find().click();await pause();const slowMenu=win.document.querySelector('.rs-menu'),slowSource=win.document.querySelector('.rs-capsule[aria-expanded="true"]').dataset.rsRowItem;
  const stableNeighbor=[...win.document.querySelectorAll('.row')].find(r=>!r.contains(win.document.querySelector('.rs-capsule[aria-expanded="true"]')));
  const oldLabel=STATES[3].label;slowMenu.querySelectorAll('button')[2].click();
  check('slow save dismisses popup immediately',!win.document.querySelector('.rs-menu'));await Zotero.Promise.delay(100);
  const during=win.document.querySelector(`.rs-capsule[data-rs-row-item="${slowSource}"]`);
  check('slow save keeps committed label and normal color',during.querySelector('.rs-label').textContent===oldLabel&&during.getAttribute('aria-disabled')==='false'&&during.getAttribute('aria-busy')==='true');
  check('slow save does not replace unrelated row nodes',!stableNeighbor||stableNeighbor.isConnected);
  release();await pause();p.saveTx=delayedSave;
  check('slow save commits correct parent',stateOf(p)===2);
  await saveStatus(p,3);await pause();
  const save=p.saveTx;p.saveTx=async()=>{throw Error('Injected disk failure')};find().click();await pause();win.document.querySelectorAll('.rs-menu button')[1].click();await pause();check('injected save failure keeps original and reports error',stateOf(p)===3&&!!win.document.querySelector('.rs-error'));p.saveTx=save;
  await saveStatus(p,1);await pause();
  // Regression: the second row must never write the first row's tags.
  const first=new Zotero.Item('journalArticle');first.setField('title','Binding A first');first.addTag('/keep-first',0);await first.saveTx();await saveStatus(first,3);
  const second=new Zotero.Item('journalArticle');second.setField('title','Binding B second');second.addTag('/keep-second',0);await second.saveTx();await saveStatus(second,0);
  await tree.selectItem(second.id);await pause();
  const column=Zotero.ItemTreeManager.getCustomColumns().find(c=>c.pluginID==='reading-status-capsules@independent.local');
  const deliberatelyStale=column.dataProvider(first);
  const rendered=column.renderCell.call(tree,tree.getRowIndexByID(second.id),deliberatelyStale,{className:''},false,win.document);
  check('cached first-row data cannot bind second-row cell',rendered.querySelector('button').dataset.rsItem===String(second.id)&&rendered.querySelector('.rs-label').textContent==='New');
  await tree.selectItem(first.id);await pause();tree.tree.scrollToRow(tree.getRowIndexByID(second.id));await pause();
  let secondButton=()=>[...win.document.querySelectorAll('.rs-capsule')].find(b=>b.dataset.rsRowItem===String(second.id));
  nativeClick(secondButton());await pause();check('clicking second capsule selects second item',tree.getSelectedItems(true).join(',')===String(second.id));
  nativeClick(win.document.querySelectorAll('.rs-menu button')[2]);await pause();
  check('second save changes second, not first',stateOf(second)===2&&stateOf(first)===3&&first.hasTag('/keep-first')&&second.hasTag('/keep-second'));
  await tree.selectItem(second.id);await pause();nativeClick(secondButton());await pause();
  const oldMenu=win.document.querySelector('.rs-menu');
  tree.tree.scrollToRow(tree.getRowIndexByID(first.id));
  const firstTitle=[...win.document.querySelectorAll('.rs-capsule')].find(b=>b.dataset.rsRowItem===String(first.id)).closest('.row').querySelector('.cell.title');
  nativeClick(firstTitle);await pause();
  if(oldMenu)oldMenu.querySelectorAll('button')[1].click();await pause();
  check('selection change cannot redirect stale menu save',stateOf(second)===2&&stateOf(first)===3);
  await tree.selectItem(p.id);await pause();
  // Generate only temporary test fixtures, in one transaction.
  await Zotero.DB.executeTransaction(async()=>{for(let i=0;i<100;i++){const q=new Zotero.Item('journalArticle');q.setField('title','Scroll fixture '+String(i).padStart(3,'0'));q.addTag(STATES[i%5].tag,0);await q.save();}});await pause();
  const statusIndex=tree._getColumns().findIndex(c=>c.label==='状态');await tree._handleColumnSort(statusIndex,1);await pause();
  const topRows=tree._rows.filter(r=>r.ref?.isRegularItem());const ranks=topRows.map(r=>stateOf(r.ref));check('reading status ascending sort',ranks.every((r,i)=>i===0||ranks[i-1]<=r));
  for(const row of [0,40,80,5]){tree.tree.scrollToRow(row);await pause();check('virtualized rows match IDs at '+row,[...win.document.querySelectorAll('.rs-capsule')].every(b=>b.querySelector('.rs-label').textContent===STATES[stateOf(Zotero.Items.get(Number(b.dataset.rsItem)))].label));}
  // Each status change moves rows when sorted, but selection stays on the ID.
  await tree.selectItem(second.id);await pause();
  for(const rank of [0,4,2,3,1,0,3,2]){
    secondButton=()=>[...win.document.querySelectorAll('.rs-capsule')].find(b=>b.dataset.rsRowItem===String(second.id));
    nativeClick(secondButton());await pause();
    const option=win.document.querySelectorAll('.rs-menu button')[rank],or=option.getBoundingClientRect();const ex=or.right-8,ey=or.top+or.height/2;
    win.windowUtils.sendMouseEvent('mousedown',ex,ey,0,1,0);win.windowUtils.sendMouseEvent('mouseup',ex,ey,0,1,0);await pause();
    check('sorted status '+rank+' preserves second item selection',tree.getSelectedItems(true).join(',')===String(second.id)&&stateOf(second)===rank&&stateOf(first)===3);
    const hit=win.document.elementFromPoint(ex,ey)?.closest('.row');const hm=hit?.id.match(/-row-(\d+)$/);const underlying=hm?tree.getRow(Number(hm[1]))?.ref?.id:null;
    report.extraReleaseTargets||=[];report.extraReleaseTargets.push({selected:second.id,underlying,rank});
    win.windowUtils.sendMouseEvent('mouseup',ex,ey,0,1,0);await pause();
    check('extra mouseup after sorted status '+rank+' retains second item',tree.getSelectedItems(true).join(',')===String(second.id));
  }
  check('extra mouseup exercised underlying foreign rows',report.extraReleaseTargets.some(v=>v.underlying&&v.underlying!==v.selected));
  tree.tree.scrollToRow(tree.getRowIndexByID(first.id));await pause();
  const titleOfFirst=[...win.document.querySelectorAll('.rs-capsule')].find(b=>b.dataset.rsRowItem===String(first.id)).closest('.row').querySelector('.cell-text');
  nativeClick(titleOfFirst);await pause();check('normal row click still selects first item after plugin gesture',tree.getSelectedItems(true).join(',')===String(first.id));
  await tree.selectItem(second.id);await pause();
  const realSave=second.saveTx;second.saveTx=async function(options){await Zotero.Promise.delay(200);return realSave.call(this,options);};
  nativeClick(secondButton());await pause();win.document.querySelectorAll('.rs-menu button')[4].click();
  tree.tree.scrollToRow(tree.getRowIndexByID(first.id));
  const freshTitle=[...win.document.querySelectorAll('.rs-capsule')].find(b=>b.dataset.rsRowItem===String(first.id)).closest('.row').querySelector('.cell-text');
  nativeClick(freshTitle);await pause();second.saveTx=realSave;
  check('new user selection during save is not pulled back',tree.getSelectedItems(true).join(',')===String(first.id)&&stateOf(second)===4&&stateOf(first)===3);
  await tree.selectItem(p.id);await pause();
  // Capture the rendered chrome window without touching the desktop or daily profile.
  for(const mode of ['light','dark']){
   Zotero.Prefs.set('extensions.readingStatusCapsules.theme',mode,true);await pause();find().click();await pause();
   try {const canvas=win.document.createElementNS('http://www.w3.org/1999/xhtml','canvas');canvas.width=win.innerWidth;canvas.height=win.innerHeight;const ctx=canvas.getContext('2d');const snapshot=await win.browsingContext.currentWindowGlobal.drawSnapshot(new win.DOMRect(0,0,win.innerWidth,win.innerHeight),1,'rgb(255,255,255)');ctx.drawImage(snapshot,0,0);snapshot.close();const bytes=Uint8Array.from(win.atob(canvas.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0));await win.IOUtils.write(output+'/'+(report.withThemeFixture?'themeFixture-':'')+mode+'.png',bytes);report.screenshots.push((report.withThemeFixture?'themeFixture-':'')+mode+'.png');}catch(e){report.screenshotError=String(e)}
   win.document.querySelector('.rs-menu button').dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  }
  const prefsWindow=Zotero.Utilities.Internal.openPreferences('reading-status-capsules-settings');
  for(let i=0;i<30&&!prefsWindow.document.querySelector('.rs-settings .rs-preview .rs-capsule');i++)await Zotero.Promise.delay(200);
  const box=prefsWindow.document.querySelector('.rs-settings');check('independent settings page renders',box?.querySelectorAll('.rs-preview .rs-capsule').length===5);
  const widths=[...box.querySelectorAll('.rs-preview .rs-capsule')].map(b=>b.getBoundingClientRect().width);check('five capsule widths are equal',widths.every(w=>Math.abs(w-widths[0])<.5)&&Math.abs(widths[0]-96)<.5);
  check('display labels match requested names',[...box.querySelectorAll('.rs-label')].map(b=>b.textContent).join('|')==='New|To Read|Reading|Finished|UnRead');
  box.querySelector('[data-rs-mode="light"]').click();check('theme preference saves',Zotero.Prefs.get('extensions.readingStatusCapsules.theme',true)==='light');
  const seedInput=box.querySelector('.rs-seed');seedInput.value='#006b59';seedInput.dispatchEvent(new prefsWindow.Event('input',{bubbles:true}));check('seed preference saves',Zotero.Prefs.get('extensions.readingStatusCapsules.seed',true)==='#006b59');
  try{const canvas=prefsWindow.document.createElementNS('http://www.w3.org/1999/xhtml','canvas');canvas.width=prefsWindow.innerWidth;canvas.height=prefsWindow.innerHeight;const snapshot=await prefsWindow.browsingContext.currentWindowGlobal.drawSnapshot(new prefsWindow.DOMRect(0,0,canvas.width,canvas.height),1,'rgb(255,255,255)');canvas.getContext('2d').drawImage(snapshot,0,0);snapshot.close();await win.IOUtils.write(output+'/'+(report.withThemeFixture?'themeFixture-':'')+'settings.png',Uint8Array.from(win.atob(canvas.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0)));report.screenshots.push((report.withThemeFixture?'themeFixture-':'')+'settings.png');}catch(e){report.settingsScreenshotError=String(e)}
  prefsWindow.close();Zotero.Prefs.set('extensions.readingStatusCapsules.seed','#6750a4',true);
  const pk=tree._getColumns()[statusIndex].dataKey;
  for(const width of [48,112,160]){const cp=JSON.parse(JSON.stringify(tree._getColumnPrefs()));cp[pk].width=width;tree._storeColumnPrefs(cp);Zotero.ItemTreeManager.refreshColumns();await pause();await tree.selectItem(p.id);await pause();find().click();await pause();const m=win.document.querySelector('.rs-menu');const r=m.getBoundingClientRect();check('menu inside window at width '+width,r.left>=0&&r.right<=win.innerWidth&&r.top>=0&&r.bottom<=win.innerHeight);key(m.querySelector('button'),'Escape');}
  report.windowSizes=[];
  for(const [w,h] of [[820,600],[1240,760]]){win.resizeTo(w,h);await pause();await tree.selectItem(p.id);await pause();find().click();await pause();const m=win.document.querySelector('.rs-menu');const r=m.getBoundingClientRect();report.windowSizes.push([win.innerWidth,win.innerHeight]);check('resized window menu fits '+w,r.left>=0&&r.right<=win.innerWidth&&r.top>=0&&r.bottom<=win.innerHeight);key(m.querySelector('button'),'Escape');}
  const customPrefs=Zotero.Utilities.Internal.openPreferences('reading-status-capsules-settings');
  for(let i=0;i<30&&!customPrefs.document.querySelector('.rs-status-editor input');i++)await Zotero.Promise.delay(200);
  const customBox=customPrefs.document.querySelector('.rs-settings'), cd=customPrefs.document;
  const editEvent=el=>el.dispatchEvent(new customPrefs.Event('change',{bubbles:true}));
  customBox.querySelector('.rs-new-label').value='Review';customBox.querySelector('.rs-new-color').value='#8c42d4';customBox.querySelector('.rs-add-status').dispatchEvent(new customPrefs.Event('submit',{bubbles:true,cancelable:true}));await pause();
  let customConfig=configure(JSON.parse(Zotero.Prefs.get('extensions.readingStatusCapsules.states',true))),customState=STATES.find(s=>s.label==='Review');
  check('settings add custom state with isolated stable tag',STATES.length===6&&customState.tag.startsWith('/reading-status/custom-'));
  let customRow=()=>[...cd.querySelectorAll('.rs-status-row')].find(r=>r.dataset.rsTag===customState.tag);
  const name=customRow().querySelector('input[type="text"]');name.value='复核';editEvent(name);await pause();
  const color=customRow().querySelector('input[type="color"]');color.value='#009688';editEvent(color);await pause();
  for(let i=0;i<5;i++){customRow().querySelector('button').click();await pause();}
  customConfig=configure(JSON.parse(Zotero.Prefs.get('extensions.readingStatusCapsules.states',true)));customState=STATES.find(s=>s.tag===customState.tag);
  check('settings rename recolor reorder retain identity',customState.label==='复核'&&customState.color==='#009688'&&customConfig.order[0]===customState.tag);
  const sortedRanks=tree._rows.filter(r=>r.ref?.isRegularItem()).map(r=>sortRank(stateOf(r.ref)));check('configuration immediately updates active status sorting',sortedRanks.every((r,i)=>!i||sortedRanks[i-1]<=r));
  customPrefs.close();await tree.selectItem(p.id);await pause();find().click();await pause();
  check('custom menu follows configured order',win.document.querySelectorAll('.rs-menu button').length===6&&win.document.querySelector('.rs-menu button').textContent.includes('复核'));
  nativeClick(win.document.querySelector('.rs-menu button'));await pause();
  check('custom status saves and preserves selected source',p.hasTag(customState.tag)&&stateOf(p)===5&&tree.getSelectedItems(true).join(',')===String(p.id));
  const b=find(),cell=b.closest('.rs-capsule-cell');check('capsule and label are left aligned',win.getComputedStyle(cell).justifyContent==='flex-start'&&win.getComputedStyle(b.querySelector('.rs-label')).textAlign==='left');
  find().click();await pause();key(win.document.querySelector('.rs-menu button'),'End');key(win.document.activeElement,'Enter');await pause();check('keyboard reaches sixth menu choice',stateOf(p)===4);
  await saveStatus(p,1);await pause();
  const deletePrefs=Zotero.Utilities.Internal.openPreferences('reading-status-capsules-settings');
  for(let i=0;i<30&&!deletePrefs.document.querySelector('.rs-status-editor input');i++)await Zotero.Promise.delay(200);
  const db=deletePrefs.document.querySelector('.rs-settings');db.querySelector('.rs-new-label').value='删除测试';db.querySelector('.rs-add-status button').click();await pause();
  let deletionConfig=configure(JSON.parse(Zotero.Prefs.get('extensions.readingStatusCapsules.states',true))),deletedTag=STATES.find(s=>s.label==='删除测试').tag;
  const retiredItem=new Zotero.Item('journalArticle');retiredItem.setField('title','Deletion preservation fixture');retiredItem.addTag(deletedTag,0);retiredItem.addTag('/preserve-deletion-other',0);await retiredItem.saveTx();
  try{
    db.querySelector('[aria-label="删除状态 删除测试"]').scrollIntoView({block:'end'});await pause();
    const canvas=deletePrefs.document.createElementNS('http://www.w3.org/1999/xhtml','canvas');canvas.width=deletePrefs.innerWidth;canvas.height=deletePrefs.innerHeight;
    const snap=await deletePrefs.browsingContext.currentWindowGlobal.drawSnapshot(new deletePrefs.DOMRect(0,0,canvas.width,canvas.height),1,'rgb(255,255,255)');canvas.getContext('2d').drawImage(snap,0,0);snap.close();
    const name=(report.withThemeFixture?'themeFixture-':'')+'delete-settings.png';await win.IOUtils.write(output+'/'+name,Uint8Array.from(deletePrefs.atob(canvas.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0)));report.screenshots.push(name);
  }catch(e){report.deleteScreenshotError=String(e);}
  db.querySelector('[aria-label="删除状态 删除测试"]').click();await pause();
  deletionConfig=configure(JSON.parse(Zotero.Prefs.get('extensions.readingStatusCapsules.states',true)));
  check('delete button hides custom state without deleting library tags',!deletionConfig.custom.some(s=>s.tag===deletedTag)&&deletionConfig.retired.some(s=>s.tag===deletedTag)&&retiredItem.hasTag(deletedTag)&&retiredItem.hasTag('/preserve-deletion-other'));
  check('built-in states have no delete control',![...db.querySelectorAll('.rs-status-row')].filter(r=>['/reading-status/new','/reading-status/read'].includes(r.dataset.rsTag)).some(r=>r.querySelector('[aria-label^="删除状态"]')));
  deletePrefs.close();await tree.selectItems([retiredItem.id],true);await pause();
  const retiredButton=()=>win.document.querySelector(`.rs-capsule[data-rs-row-item="${retiredItem.id}"]`);check('deleted state remains recognizable on existing item',retiredButton().querySelector('.rs-label').textContent==='删除测试');
  retiredButton().click();await pause();check('deleted state absent from menu',![...win.document.querySelectorAll('.rs-menu button')].some(b=>b.textContent.includes('删除测试')));
  [...win.document.querySelectorAll('.rs-menu button')].find(b=>b.textContent.includes('Reading')).click();await pause();
  check('manual replacement removes retired tag and preserves other tags',!retiredItem.hasTag(deletedTag)&&retiredItem.hasTag('/reading-status/reading')&&retiredItem.hasTag('/preserve-deletion-other'));
  await Zotero.UndoHistory.undo();await pause();check('undo restores retired item tag and label',retiredItem.hasTag(deletedTag)&&retiredButton().querySelector('.rs-label').textContent==='删除测试');
  await Zotero.UndoHistory.redo();await pause();check('redo replaces retired tag again',!retiredItem.hasTag(deletedTag)&&retiredItem.hasTag('/reading-status/reading'));
  await tree.selectItem(p.id);await pause();
  const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');const own=await AddonManager.getAddonByID('reading-status-capsules@independent.local');find().click();await pause();await own.disable();await pause();check('disable cleans column menu styles and namespace',!Zotero.ItemTreeManager.getCustomColumns().some(c=>c.pluginID===own.id)&&!win.document.querySelector('.rs-menu')&&!win.document.querySelector('.rs-owned-style')&&!Zotero.ReadingStatusCapsules);check('disable retains manual status tags',p.hasTag('/reading-status/to-read'));await own.enable();await pause();check('reenable restores registered column',Zotero.ItemTreeManager.getCustomColumns().some(c=>c.pluginID===own.id));check('reenable preserves column width',tree._getColumnPrefs()[pk].width===160);
  await Zotero.File.putContentsAsync(output+'/item-id.txt',String(p.id));
 }catch(e){report.error=String(e);report.stack=e.stack;Zotero.logError(e);}
 await Zotero.File.putContentsAsync(output+'/report.json',JSON.stringify(report,null,2));
 Services.startup.quit(Ci.nsIAppStartup.eForceQuit);
}
