import test from 'node:test';
import assert from 'node:assert/strict';
import {runBasicAttack,registerMovementReactions} from '../system/phase9-combat.mjs';
const savedRandom=Math.random;
const defaultSettings={epicReactions:true,reactionChanceBase:100,reactionChancePerRank:0,
  reactionRank1Uses:1,reactionRank2Uses:3,gridRangeChecks:true,movementReactions:false,
  overwatchRadius:2,autoDamage:true};
let messages,settings,scene,tokens,events;
function actor(id,{hp=100,dodge=0,accuracy=0,talents=[],weaponRange=null,owner=true,weaponDamage=10}={}) {
  const a={id,name:id,isToken:false,isOwner:owner,items:[],flags:{},system:{health:{value:hp},derived:{stats:{
    strength:0,agility:0,will:0,accuracy,dodge,armor:0,resist:0,rough:0}}},
    async update(changes){if ('system.health.value' in changes) this.system.health.value=changes['system.health.value'];},
    getFlag(ns,key){return this.flags[key];},
    async setFlag(ns,key,value){this.flags[key]=value;}
  };
  if (weaponRange!==null) a.items.push(weapon(`${id} weapon`,weaponRange,weaponDamage));
  for (const [name,rank] of talents) a.items.push({type:'talent',name,system:{rank}});
  return a;
}
function weapon(name,range=1,damage=10){return {type:'weapon',name,system:{range,equipped:true,
  toObject(){return {attribute:'strength',damage:{min:damage,max:damage},range,
    damageType:'physical'};}}};}
function token(actor,x=0,y=0,disposition=1) {
  const doc={id:actor.id+'token',uuid:'Scene.test.Token.'+actor.id,parent:{id:'scene'},x,y,width:1,height:1,
    hidden:false,disposition,actor};
  return {id:doc.id,actor,document:doc,name:actor.name};
}
function setup({combat=false,options={}}={}) {
  Math.random=()=>0;
  settings={...defaultSettings,...options};messages=[];events={};tokens=[];
  scene={id:'scene'};
  globalThis.foundry={utils:{escapeHTML:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;')}};
  globalThis.game={user:{id:'gm',isGM:true},users:{activeGM:{id:'gm'}},
    settings:{get:(ns,key)=>settings[key]},combat:combat?{started:true,id:'fight',round:1}:null,
    pirate101:{rules:{criticalMode:'off',comparisonMode:'off'}}};
  globalThis.canvas={scene,grid:{size:100},walls:{checkCollision:()=>false},tokens:{
    controlled:[],placeables:tokens,get:id=>tokens.find(t=>t.id===id)
  }};
  globalThis.ui={notifications:{warn:()=>{},error:msg=>{throw Error(msg);}}};
  globalThis.ChatMessage={getSpeaker:({actor})=>({alias:actor.name}),
    async create(msg){messages.push(msg);}};
  globalThis.Hooks={on:(event,fn)=>{events[event]=fn;}};
  globalThis.Ray=class{constructor(a,b){this.a=a;this.b=b;}};
}
function place(...ts){tokens.push(...ts);canvas.tokens.controlled=[ts[0]];}
function textOfMessages(){return messages.map(m=>m.content).join('\n');}
test('base hit plus Relentless both apply HP; reaction stops without recursion',async()=>{
  setup();const a=actor('Pirate',{talents:[['Relentless',1]]});const b=actor('Dummy',{hp:100});
  const w=weapon('Cutlass'),ta=token(a),tb=token(b,100);a.items.push(w);place(ta,tb);
  await runBasicAttack({actor:a,weapon:w,targetToken:tb});
  assert.equal(b.system.health.value,80);assert.equal(messages.length,2);
  assert.match(messages[1].content,/RELENTLESS/);assert.match(messages[1].content,/Uses this round/);
});
test('First Strike resolves before original attack, and can interrupt a lethal attack',async()=>{
  setup();const a=actor('Pirate',{hp:5});const b=actor('Guard',{hp:100,talents:[['First Strike',1]],weaponRange:1});
  const w=weapon('Cutlass');a.items.push(w);place(token(a),token(b,100));
  await runBasicAttack({actor:a,weapon:w,targetToken:tokens[1]});
  assert.equal(a.system.health.value,0);assert.equal(b.system.health.value,100);
  assert.equal(messages.length,2);assert.match(messages[0].content,/FIRST-STRIKE/);
  assert.match(messages[1].content,/interrupted/);
});
test('Vengeance Strike retaliates after melee hit before Relentless',async()=>{
  setup();const a=actor('Pirate',{hp:100,talents:[['Relentless',1]]});
  const b=actor('Guard',{hp:100,talents:[['Vengeance Strike',1]],weaponRange:1});
  const w=weapon('Cutlass');a.items.push(w);place(token(a),token(b,100));
  await runBasicAttack({actor:a,weapon:w,targetToken:tokens[1]});
  assert.equal(messages.length,3);
  assert.match(messages[1].content,/VENGEANCE-STRIKE/);
  assert.match(messages[2].content,/RELENTLESS/);
  assert.equal(b.system.health.value,80);assert.equal(a.system.health.value,90);
});
test('Riposte counter damages initial attacker only on miss',async()=>{
  setup();const a=actor('Pirate',{hp:100});const b=actor('Guard',{hp:100,dodge:200,talents:[['Riposte',1]],weaponRange:1});
  const w=weapon('Cutlass');a.items.push(w);place(token(a),token(b,100));
  await runBasicAttack({actor:a,weapon:w,targetToken:tokens[1]});
  assert.equal(b.system.health.value,100);assert.equal(a.system.health.value,90);
  assert.match(messages[1].content,/RIPOSTE/);
});
test('Burst Fire triggers on successful ranged attack, not melee',async()=>{
  setup();const a=actor('Pirate',{talents:[['Burst Fire',1]]});const b=actor('Dummy',{hp:100});
  const w=weapon('Musket',3);a.items.push(w);place(token(a),token(b,200));
  await runBasicAttack({actor:a,weapon:w,targetToken:tokens[1]});
  assert.equal(b.system.health.value,80);assert.match(messages[1].content,/BURST-FIRE/);
});
test('rank-1 per-round limit blocks second reaction; resets automatically on new round',async()=>{
  setup({combat:true});const a=actor('Pirate',{talents:[['Relentless',1]]});const b=actor('Dummy',{hp:200});
  const w=weapon('Cutlass');a.items.push(w);place(token(a),token(b,100));
  await runBasicAttack({actor:a,weapon:w,targetToken:tokens[1]});
  await runBasicAttack({actor:a,weapon:w,targetToken:tokens[1]});
  assert.equal(b.system.health.value,170);assert.equal(messages.length,3);
  assert.deepEqual(a.flags.reactionUsage,{round:'fight:1',counts:{relentless:1}});
  game.combat.round=2;
  await runBasicAttack({actor:a,weapon:w,targetToken:tokens[1]});
  assert.equal(b.system.health.value,150);assert.equal(messages.length,5);
});
test('rank-2 allows three reaction uses per round, then stops',async()=>{
  setup({combat:true});const a=actor('Pirate',{talents:[['Relentless',2]]});const b=actor('Dummy',{hp:200});
  const w=weapon('Cutlass');a.items.push(w);place(token(a),token(b,100));
  for (let i=0;i<4;i++) await runBasicAttack({actor:a,weapon:w,targetToken:tokens[1]});
  assert.equal(b.system.health.value,130);assert.equal(messages.length,7);
  assert.equal(a.flags.reactionUsage.counts.relentless,3);
});
test('out-of-range attack safely blocked without HP change',async()=>{
  setup();const a=actor('Pirate');const b=actor('Dummy');const w=weapon('Cutlass');
  a.items.push(w);place(token(a),token(b,400));
  await runBasicAttack({actor:a,weapon:w,targetToken:tokens[1]});
  assert.equal(messages.length,0);assert.equal(b.system.health.value,100);
});
test('auto damage off previews both original and reaction with no HP change',async()=>{
  setup({options:{autoDamage:false}});const a=actor('Pirate',{talents:[['Relentless',1]]});
  const b=actor('Dummy');const w=weapon('Cutlass');a.items.push(w);place(token(a),token(b,100));
  await runBasicAttack({actor:a,weapon:w,targetToken:tokens[1]});
  assert.equal(messages.length,2);assert.equal(b.system.health.value,100);
});
test('no ownership: main attack previews; reaction skips without mutation',async()=>{
  setup();const a=actor('Pirate',{talents:[['Relentless',1]]});
  const b=actor('Dummy',{owner:false});const w=weapon('Cutlass');a.items.push(w);place(token(a),token(b,100));
  await runBasicAttack({actor:a,weapon:w,targetToken:tokens[1]});
  assert.equal(b.system.health.value,100);assert.equal(messages.length,1);
});
test('Overwatch reacts when hostile token moves into radius, but not again within radius',async()=>{
  setup({combat:true,options:{movementReactions:true}});registerMovementReactions();
  const a=actor('Musketeer',{talents:[['Overwatch',1]],weaponRange:3});
  const b=actor('Enemy',{hp:100});const ta=token(a,0,0,1);const tb=token(b,400,0,-1);
  place(ta,tb);
  await events.preUpdateToken(tb.document,{x:200});tb.document.x=200;
  await events.updateToken(tb.document,{x:200});
  assert.equal(b.system.health.value,90);assert.match(textOfMessages(),/OVERWATCH/);
  await events.preUpdateToken(tb.document,{x:100});tb.document.x=100;
  await events.updateToken(tb.document,{x:100});
  assert.equal(messages.length,1);
});
test('Overwatch does not trigger outside combat or on friendly movement',async()=>{
  setup({options:{movementReactions:true}});registerMovementReactions();
  const a=actor('Musketeer',{talents:[['Overwatch',1]],weaponRange:3});
  const b=actor('Friend');const ta=token(a,0,0,1),tb=token(b,400,0,1);place(ta,tb);
  await events.preUpdateToken(tb.document,{x:200});tb.document.x=200;
  await events.updateToken(tb.document,{x:200});assert.equal(messages.length,0);
});
test.after(()=>{Math.random=savedRandom;});
