import test from 'node:test';
import assert from 'node:assert/strict';
import {REACTION_EVENTS,talentKind,findTalent,reactionUseLimit,weaponKind,
  tokenDistance,planEventReactions} from '../system/reactions.mjs';
const melee={type:'weapon',system:{equipped:true,range:1}};
const ranged={type:'weapon',system:{equipped:true,range:3}};
const actor=(...talents)=>({items:talents.map(([name,rank=1])=>({name,type:'talent',system:{rank}}))});
const pirate=actor(['Relentless'],['Burst Fire']);
const dummy=actor(['First Strike'],['Riposte'],['Vengeance Strike']);
const plan=(event,params={})=>planEventReactions({event,attacker:pirate,defender:dummy,weapon:melee,
  defenderWeapon:melee,enabled:true,chanceBase:100,rng:()=>0,distance:1,requireDistance:true,...params});
test('all six named talents recognized through display name or trigger',()=>{
  for (const name of ['Relentless','Riposte','First Strike','Vengeance Strike','Burst Fire','Overwatch'])
    assert.ok(talentKind({name,type:'talent'}));
  assert.equal(talentKind({name:'First Strike',type:'power'}),null);
  assert.equal(talentKind({name:'custom',type:'talent',system:{trigger:'Vengeance Strike'}}),'vengeance-strike');
  assert.ok(findTalent(dummy,'riposte'));
});
test('fixed event priority',()=>{
  assert.deepEqual(REACTION_EVENTS.afterHit,['vengeance-strike','relentless','burst-fire']);
  assert.deepEqual(REACTION_EVENTS.beforeMelee,['first-strike']);
});
test('rank based use caps',()=>{
  assert.equal(reactionUseLimit(1),1);
  assert.equal(reactionUseLimit(2),3);
  assert.equal(reactionUseLimit(5),3);
  assert.equal(reactionUseLimit(2,1,5),5);
});
test('weapon melee/ranged and unequipped distinction',()=>{
  assert.equal(weaponKind(melee),'melee');assert.equal(weaponKind(ranged),'ranged');
  assert.equal(weaponKind({type:'weapon',system:{range:3,equipped:false}}),null);
});
test('rectangle distance handles adjacency, gap and large tokens',()=>{
  const a={x:0,y:0,width:1,height:1};
  assert.equal(tokenDistance(a,{x:100,y:0,width:1,height:1}),1);
  assert.equal(tokenDistance(a,{x:200,y:0,width:1,height:1}),2);
  assert.equal(tokenDistance({x:0,y:0,width:2,height:2},{x:200,y:100,width:1,height:1}),1);
  assert.equal(tokenDistance(a,null),null);
});
test('First Strike before incoming melee',()=>{
  const r=plan('beforeMelee'); assert.equal(r.length,1);assert.equal(r[0].kind,'first-strike');
});
test('Vengeance Strike then Relentless after melee hit',()=>{
  assert.deepEqual(plan('afterHit').map(r=>r.kind),['vengeance-strike','relentless']);
});
test('Riposte after melee miss',()=>{
  assert.deepEqual(plan('afterMiss').map(r=>r.kind),['riposte']);
});
test('Burst Fire on ranged hit only',()=>{
  assert.deepEqual(plan('afterHit',{weapon:ranged,defenderWeapon:melee}).map(r=>r.kind),['burst-fire']);
  assert.deepEqual(plan('afterMiss',{weapon:ranged,defenderWeapon:melee}),[]);
});
test('melee reactions require adjacency when checked',()=>{
  assert.equal(plan('afterHit',{distance:2}).length,0);
  assert.equal(plan('afterHit',{distance:null}).length,0);
  assert.equal(plan('afterHit',{distance:null,requireDistance:false}).length,2);
});
test('reaction depth 1 blocks recursive chains',()=>{
  assert.equal(plan('afterHit',{depth:1}).length,0);
});
test('reaction usage stops at cap, but other talents remain eligible',()=>{
  assert.deepEqual(plan('afterHit',{uses:{'vengeance-strike':1}}).map(r=>r.kind),['relentless']);
  assert.deepEqual(plan('afterHit',{uses:{'vengeance-strike':1,'relentless':1}}),[]);
});
test('rank 2 gets three uses, and fourth is blocked',()=>{
  const a=actor(['Relentless',2]);
  assert.equal(plan('afterHit',{attacker:a,uses:{relentless:2}}).length,2); // vengeance + relentless
  assert.deepEqual(plan('afterHit',{attacker:a,uses:{relentless:3}}).map(r=>r.kind),['vengeance-strike']);
});
test('probability fail does not produce an activation',()=>{
  assert.equal(plan('afterHit',{chanceBase:0,chancePerRank:0,rng:()=>0.5}).length,0);
});
test('Overwatch triggers only when entering a watcher radius with ranged weapon',()=>{
  const watcher=actor(['Overwatch']);
  const basic={event:'movementEnter',attacker:watcher,defender:dummy,weapon:ranged,
    enabled:true,chanceBase:100,rng:()=>0,overwatchRadius:2};
  assert.deepEqual(planEventReactions({...basic,priorDistance:3,distance:2}).map(r=>r.kind),['overwatch']);
  assert.equal(planEventReactions({...basic,priorDistance:2,distance:1}).length,0);
  assert.equal(planEventReactions({...basic,priorDistance:3,distance:3}).length,0);
  assert.equal(planEventReactions({...basic,weapon:melee,priorDistance:3,distance:2}).length,0);
  assert.equal(planEventReactions({...basic,priorDistance:3,distance:2,uses:{overwatch:1}}).length,0);
});
test('Overwatch requires weapon to reach entered distance',()=>{
  const watcher=actor(['Overwatch']);
  assert.equal(planEventReactions({event:'movementEnter',attacker:watcher,defender:dummy,
    weapon:{type:'weapon',system:{range:1.5,equipped:true}},enabled:true,chanceBase:100,rng:()=>0,
    priorDistance:3,distance:2}).length,0);
});
test('empty, disabled, invalid events are safe',()=>{
  assert.deepEqual(plan('afterHit',{enabled:false}),[]);
  assert.deepEqual(plan('notAnEvent'),[]);
  assert.deepEqual(plan('afterHit',{maxDepth:0}),[]);
});
