import test from 'node:test';
import assert from 'node:assert/strict';
import { STATES, stateOf, target, replacement, saveStatus, initialColumnPrefs, rowBinding, selectionMatches, configure, sortRank, orderedIndices, retireState, stateIndex, defaultConfiguration } from '../src/model.js';
import { colorCSS } from '../src/colors.js';
import { Hct, argbFromHex } from '@material/material-color-utilities';
const item = (tags=[]) => ({ id:1, tags, getTags(){return this.tags}, setTags(t){this.tags=t}, isEditable(){return true}, isRegularItem(){return true}, async saveTx(options){this.saved=options} });
test('default New is computed without writing',()=> { const x=item();assert.equal(stateOf(x),0);assert.deepEqual(x.tags,[]); });
for(let i=0;i<5;i++) test(`manual ${STATES[i].label} stores exactly its dedicated tag with undo`,async()=> { const x=item([{tag:'/done',type:1},{tag:'keep',type:0},...STATES.map(s=>({tag:s.tag,type:1}))]); await saveStatus(x,i);assert.equal(stateOf(x),i);assert.deepEqual(x.tags,[{tag:'/done',type:1},{tag:'keep',type:0},{tag:STATES[i].tag,type:0}]);assert.equal(x.saved.undoAction,'undo-action-edit-metadata'); });
test('conflicts have deterministic priority and reads never clean',()=> { const x=item(STATES.map(s=>({tag:s.tag})));assert.equal(stateOf(x),2);assert.equal(x.tags.length,5); });
test('failed transaction restores original in-memory tags',async()=> {const x=item([{tag:'/reading-status/read',type:0},{tag:'other',type:1}]);const original=structuredClone(x.tags);x.saveTx=async()=> {throw Error('disk full')};await assert.rejects(saveStatus(x,1));assert.deepEqual(x.tags,original); });
test('read-only and trash refused before mutation',async()=> {for(const deleted of [true,false]) {const x=item();x.deleted=deleted;x.isEditable=()=>deleted;await assert.rejects(saveStatus(x,2));assert.deepEqual(x.tags,[]);} });
test('PDF uses regular parent; other rows do not edit',()=> {const p=item();const pdf={isRegularItem:()=>false,isPDFAttachment:()=>true,parentItemID:1};assert.equal(target(pdf,()=>p),p);assert.equal(target({...pdf,parentItemID:null},()=>p),null);assert.equal(target({isRegularItem:()=>false,isPDFAttachment:()=>false},()=>p),null);assert.equal(target({...pdf},()=>null),null); });
test('invalid status cannot write',()=> assert.throws(()=>replacement([],8)));
test('initial position preserves existing width and order thereafter',()=> {const columns=[{dataKey:'title'},{dataKey:'firstCreator'},{dataKey:'status'}];const prefs={title:{ordinal:0,width:400},firstCreator:{ordinal:1,width:100}};const result=initialColumnPrefs(prefs,columns,'status');assert.equal(result.status.ordinal,1);assert.equal(result.firstCreator.ordinal,2);assert.equal(result.title.width,400);assert.equal(initialColumnPrefs(result,columns,'status'),null);assert.equal(prefs.firstCreator.ordinal,1); });
test('seed generates independent light/dark MD3 roles with readable status text',()=> { for(const dark of [false,true]) {const css=colorCSS('#6750a4',dark);assert.match(css,/--rs-primary:#[0-9a-f]{6}/);const roles=Object.fromEntries([...css.matchAll(/--rs-([\w-]+):(#[\da-f]{6});/g)].map(m=>[m[1],m[2]]));const lum=hex=>{const c=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722};for(let i=0;i<5;i++){const [a,b]=[lum(roles['bg-'+i]),lum(roles['fg-'+i])].sort((a,b)=>b-a);assert.ok((a+.05)/(b+.05)>4.5);} }assert.notEqual(colorCSS('#6750a4',false),colorCSS('#006b59',false)); });

test('row binding uses current host row and parent identity, never cached column data',()=>{const a=item();a.id=10;const b=item();b.id=20;const tree={getRow:()=>({ref:b})};assert.equal(rowBinding(tree,1,()=>a).targetID,20);assert.equal(rowBinding({getRow:()=>({ref:{id:30,isRegularItem:()=>false,isPDFAttachment:()=>true,parentItemID:20}})},1,()=>b).sourceID,30);});
test('selection snapshot requires the same single source item',()=>{assert.equal(selectionMatches([20],20),true);assert.equal(selectionMatches([10],20),false);assert.equal(selectionMatches([10,20],20),false);assert.equal(selectionMatches([],20),false);});
test('seed harmonization changes colors without losing semantic hue and contrast',()=>{
 const read=(seed,dark,on)=>Object.fromEntries([...colorCSS(seed,dark,[],on).matchAll(/--rs-([\w-]+):(#[\da-f]{6});/g)].map(m=>[m[1],m[2]]));
 const lum=hex=>{const c=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
 for(const dark of [false,true])for(const seed of ['#6750a4','#006b59','#ff0000','#ffff00','#0000ff','#ffffff','#000000']){
  const plain=read(seed,dark,false),tinted=read(seed,dark,true);
  assert.equal(new Set([0,1,2,3,4].map(i=>tinted['bg-'+i])).size,5);
  for(let i=0;i<5;i++){
   const h=Hct.fromInt(argbFromHex(tinted['bg-'+i])),base=Hct.fromInt(argbFromHex(plain['bg-'+i]));
   if(i<4){const diff=Math.abs(h.hue-base.hue);assert.ok(Math.min(diff,360-diff)<17);}else assert.ok(h.chroma<7);
   const [a,b]=[lum(tinted['bg-'+i]),lum(tinted['fg-'+i])].sort((a,b)=>b-a);assert.ok((a+.05)/(b+.05)>4.5);
  }
  assert.equal(plain['bg-0'],read('#006b59',dark,false)['bg-0']);
 }
 assert.notEqual(read('#6750a4',false,true)['bg-4'],read('#006b59',false,true)['bg-4']);
});

test('custom states retain tag identities across rename, recolor and reordering',async()=>{
 try {
  const tag='/reading-status/custom-example';
  const config=configure({custom:[{tag,label:'Review',color:'#ff00ff'}],order:[tag, '/reading-status/read']});
  assert.equal(STATES.length,6);assert.equal(sortRank(5),0);assert.equal(orderedIndices()[0],5);
  const x=item([{tag:'/done',type:1},{tag:'/reading-status/reading',type:0}]);await saveStatus(x,5);
  assert.equal(stateOf(x),5);assert.deepEqual(x.tags,[{tag:'/done',type:1},{tag,type:0}]);
  config.overrides[tag]={label:'复核',color:'#008080'};configure(config);
  assert.equal(STATES[5].label,'复核');assert.equal(STATES[5].tag,tag);assert.equal(stateOf(x),5);
  assert.match(colorCSS('#6750a4',true,STATES),/--rs-bg-5:/);
  await saveStatus(x,0);assert.equal(x.tags.some(t=>t.tag===tag),false);
 }finally{configure();}
});
test('configuration validates namespace and deduplicates sort order',()=>{
 try {configure({custom:[{tag:'/done',label:'bad'},{tag:'/reading-status/custom-ok',label:'ok'},{tag:'/reading-status/custom-ok',label:'duplicate'}],order:['bad','/reading-status/read','/reading-status/read']});assert.equal(STATES.length,6);assert.equal(orderedIndices().length,6);assert.equal(sortRank(3),0);assert.equal(stateOf(item()),0);}finally{configure();}
});

test('choosing an already stored manual status avoids save and undo work',async()=>{
 const x=item([{tag:'/reading-status/reading',type:0},{tag:'keep',type:1}]);x.saveTx=async()=>{throw Error('should not save');};
 assert.equal(await saveStatus(x,2),false);assert.equal(stateOf(x),2);assert.equal(x.tags.length,2);
});
test('same displayed status still writes for conflicts or automatic tags',async()=>{
 const x=item([{tag:'/reading-status/reading',type:1},{tag:'/reading-status/new',type:0}]);await saveStatus(x,2);assert.equal(x.tags.length,1);assert.equal(x.tags[0].type,0);assert.ok(x.saved);
});

test('deleting custom state hides it without deleting existing item tags',async()=>{
 try{
  const tag='/reading-status/custom-retired';let config=configure({custom:[{tag,label:'复核',color:'#008080'}]});const x=item([{tag,type:0},{tag:'keep',type:1}]);
  config=configure(retireState(config,tag));const retired=stateIndex(tag);
  assert.equal(config.custom.length,0);assert.equal(config.retired.length,1);assert.equal(STATES[retired].label,'复核');assert.equal(stateOf(x),retired);assert.equal(orderedIndices().includes(retired),false);assert.equal(x.tags[0].tag,tag);
  await assert.rejects(saveStatus(x,retired));await saveStatus(x,1);assert.deepEqual(x.tags,[{tag:'keep',type:1},{tag:'/reading-status/to-read',type:0}]);
 }finally{configure();}
});
test('built-in states cannot be deleted and retired state survives reload',()=>{
 try{let config=configure({custom:[{tag:'/reading-status/custom-r',label:'Review'}]});assert.throws(()=>retireState(config,'/reading-status/new'));config=configure(retireState(config,'/reading-status/custom-r'));configure(JSON.parse(JSON.stringify(config)));assert.equal(stateOf(item([{tag:'/reading-status/custom-r'}])),5);assert.equal(orderedIndices().length,5);}finally{configure();}
});

test('custom colors harmonize without changing saved color definitions',()=>{
 const definitions=[...STATES,{label:'Custom',tag:'/reading-status/custom-color',color:'#336699'}],before=JSON.stringify(definitions);
 const color=(seed,on)=>colorCSS(seed,false,definitions,on).match(/--rs-bg-5:(#[0-9a-f]{6});/)[1];
 assert.notEqual(color('#6750a4',true),color('#006b59',true));assert.equal(color('#6750a4',false),color('#006b59',false));assert.equal(JSON.stringify(definitions),before);
});

test('restore defaults resets builtins and retains custom tag recognition',async()=>{
 try{
  const tag='/reading-status/custom-reset';const config=configure({custom:[{tag,label:'Review',color:'#008080'}],overrides:{[tag]:{label:'复核',color:'#336699'},'/reading-status/new':{label:'新文献',color:'#000000'}},order:[tag,'/reading-status/read']});
  const x=item([{tag,type:0},{tag:'keep',type:1}]),before=JSON.stringify(x.tags);
  const reset=configure(defaultConfiguration(config));assert.equal(reset.custom.length,0);assert.equal(reset.retired[0].label,'复核');assert.deepEqual(orderedIndices(),[0,1,2,3,4]);assert.equal(STATES[0].label,'New');assert.equal(STATES[0].color,undefined);assert.equal(JSON.stringify(x.tags),before);assert.equal(STATES[stateOf(x)].label,'复核');
  await saveStatus(x,1);assert.equal(x.tags.some(t=>t.tag===tag),false);assert.ok(x.tags.some(t=>t.tag==='keep'));
 }finally{configure();}
});
