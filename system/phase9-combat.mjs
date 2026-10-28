/** Foundry-facing Phase 9 orchestrator.
 * Explicitly avoids GM socket impersonation. Reaction damage requires ownership.
 * Reaction attacks do not generate more reactions; only an initial basic attack
 * can generate before/after events, plus GM-processed enemy movement.
 */
import {resolveBasicAttack} from './rules.mjs';
import {planEventReactions,tokenDistance,weaponKind} from './reactions.mjs';
const NS='pirate101-flex';
const priorTokenPosition=new Map();
const moveProcessing=new Set();
const finiteHP=actor=>Number(actor?.system?.health?.value ?? 0);
const safe=s=>foundry.utils.escapeHTML(String(s ?? ''));
const setting=(key)=>game.settings.get(NS,key);

function currentRoundKey() {
  const combat=game.combat;
  return combat?.started && Number(combat.round)>0 ? `${combat.id}:${combat.round}` : null;
}
function usageFor(actor) {
  const round=currentRoundKey();
  if (!round) return {};
  const state=actor.getFlag(NS,'reactionUsage');
  return state?.round===round ? {...state.counts} : {};
}
async function consumeUsage(actor,kind) {
  const round=currentRoundKey();
  if (!round) return;
  const counts=usageFor(actor);
  counts[kind]=(counts[kind]||0)+1;
  await actor.setFlag(NS,'reactionUsage',{round,counts});
}
function tokenDoc(token) {return token?.document ?? token;}
function distanceBetween(a,b) {
  if (!a || !b || !canvas?.scene) return null;
  const ad=tokenDoc(a),bd=tokenDoc(b);
  if (ad.parent?.id !== bd.parent?.id || ad.parent?.id !== canvas.scene.id) return null;
  return tokenDistance(ad,bd,Number(canvas.grid?.size || canvas.scene.grid?.size || 100));
}
function tokenForActor(actor) {
  const tokens=canvas?.tokens?.placeables || [];
  const matches=t=>t.actor?.id===actor.id && t.actor?.isToken===actor.isToken;
  return (canvas.tokens.controlled || []).find(matches) || tokens.find(matches) ||
    (canvas.tokens.controlled || []).find(t=>t.actor?.id===actor.id) || tokens.find(t=>t.actor?.id===actor.id) || null;
}
function readyWeapon(actor,kind) {
  return actor?.items?.find(item=>item.type==='weapon' && item.system?.equipped && weaponKind(item)===kind) || null;
}
function eligibleEnemies(a,b) {
  const x=Number(tokenDoc(a)?.disposition),y=Number(tokenDoc(b)?.disposition);
  return (x===-1 && y===1) || (x===1 && y===-1);
}
function isObstructed(a,b) {
  // Best-effort sight check; never bypasses token visibility/permissions checks.
  const walls=canvas?.walls;
  if (!walls?.checkCollision || typeof Ray==='undefined') return false;
  const ad=tokenDoc(a),bd=tokenDoc(b);
  const g=Number(canvas.grid?.size || 100);
  const center=t=>({x:t.x+(t.width || 1)*g/2,y:t.y+(t.height || 1)*g/2});
  try { return !!walls.checkCollision(new Ray(center(ad),center(bd)),{type:'sight',mode:'any'}); }
  catch(err) {console.warn('Pirate101 | sight check unavailable, skipping movement reaction',err);return true;}
}
function getSettings() {
  return {
    enabled:setting('epicReactions'),chanceBase:setting('reactionChanceBase'),
    chancePerRank:setting('reactionChancePerRank'),rank1Uses:setting('reactionRank1Uses'),
    rank2Uses:setting('reactionRank2Uses'),requireDistance:setting('gridRangeChecks'),
    overwatchRadius:setting('overwatchRadius')
  };
}
async function postAttack(actor,target,weapon,result,applied,previousHP,nextHP,extra='') {
  const comparison=result.comparison?.mode==='linear' ? `<p>Attribute comparison: ${result.comparison.difference>=0?'+':''}${result.comparison.difference} (${result.comparison.percent}% bonus; linear approximation)</p>` : '';
  const critical=result.critical?.tier && result.critical.tier!=='none' ? `<p>Critical: <strong>${safe(result.critical.tier.toUpperCase())}</strong> (×${result.critical.multiplier})</p>` : '';
  const message=`<div class="p101-attack-card"><h3>${safe(actor.name)} attacks ${safe(target.name)} with ${safe(weapon.name)}</h3><p>Hit roll: ${result.hit.roll} / ${result.hit.chance}% — <strong>${result.hit.hit?'Hit':'Miss'}</strong></p><p>Damage: <strong>${result.damage}</strong></p>${comparison}${critical}<p>${applied?`HP: ${previousHP} → ${nextHP}`:'Preview only — target HP unchanged'}</p>${extra}<small>Phase 9 experimental: damage/critical formulas remain configurable; high-rank effects, powers, and full attack-chain rules are not yet implemented.</small></div>`;
  await ChatMessage.create({user:game.user.id,speaker:ChatMessage.getSpeaker({actor}),content:message});
}
async function applyDamage(victim,result,auto) {
  const before=finiteHP(victim);
  const after=Math.max(0,before-result.damage);
  let applied=false;
  if (auto && result.hit.hit && result.damage>0 && victim.isOwner) {
    await victim.update({'system.health.value':after});
    applied=true;
  }
  return {before,after,applied};
}
async function executeReaction(reaction) {
  const {owner,target,weapon,kind}=reaction;
  if (finiteHP(owner)<=0 || finiteHP(target)<=0) return false;
  // Never mutate either participant without sufficient document permission.
  if (!owner.isOwner) {
    ui.notifications.warn(`${reaction.talent} belongs to ${owner.name}; only the GM or its owner can resolve this reaction.`);
    return false;
  }
  if (!target.isOwner) {
    ui.notifications.warn(`${reaction.talent} available but you lack ownership of ${target.name}; reaction skipped.`);
    return false;
  }
  await consumeUsage(owner,kind);
  const result=resolveBasicAttack({attacker:owner.system.derived.stats,defender:target.system.derived.stats,
    weapon:weapon.system.toObject(),rules:game.pirate101.rules});
  const hp=await applyDamage(target,result,setting('autoDamage'));
  const critical=result.critical?.tier && result.critical.tier!=='none' ? `<p>Critical: ${safe(result.critical.tier.toUpperCase())} (×${result.critical.multiplier})</p>`:'';
  const content=`<div class="p101-attack-card"><h3>${safe(owner.name)} uses ${safe(reaction.talent)} against ${safe(target.name)}</h3><p>Reaction: ${safe(kind.toUpperCase())} (rank ${reaction.rank}, trigger roll ${reaction.roll} / ${reaction.chance}%)</p><p>Uses this round: ${reaction.used+1} / ${reaction.limit}${currentRoundKey()?'':' (not tracked outside combat)'}</p><p>Follow-up hit roll: ${result.hit.roll} / ${result.hit.chance}% — <strong>${result.hit.hit?'Hit':'Miss'}</strong></p><p>Damage: ${result.damage}</p>${critical}<p>${hp.applied?`HP: ${hp.before} → ${hp.after}`:'Preview only — HP unchanged'}</p><small>Phase 9: reaction attacks cannot themselves trigger reactions; advanced rank effects are not automated.</small></div>`;
  await ChatMessage.create({user:game.user.id,speaker:ChatMessage.getSpeaker({actor:owner}),content});
  return true;
}
async function eventReactions({event,attacker,defender,weapon,defenderWeapon,distance,priorDistance}) {
  const config=getSettings();
  if (!config.enabled) return;
  // Re-evaluate usage after each trigger, to avoid exceeding use caps in one event.
  const ordered=event==='beforeMelee'?['first-strike']:event==='afterHit'?['vengeance-strike','relentless','burst-fire']:event==='afterMiss'?['riposte']:['overwatch'];
  for (const kind of ordered) {
    if (finiteHP(attacker)<=0 || finiteHP(defender)<=0) break;
    const owner=['first-strike','vengeance-strike','riposte'].includes(kind)?defender:attacker;
    const options={event,attacker,defender,weapon,defenderWeapon,distance,priorDistance,...config,
      uses:usageFor(owner),onlyKind:kind};
    const reaction=planEventReactions(options).find(r=>r.kind===kind);
    // Only the intended kind is applied at each priority step.
    if (reaction) await executeReaction(reaction);
  }
}
export async function runBasicAttack({actor,weapon,targetToken}) {
  const target=targetToken?.actor;
  if (!target || !weapon?.system?.equipped || target.id===actor.id && !target.isToken) {
    ui.notifications.warn('Target another actor and equip a weapon first.');return;
  }
  if (!actor.system.derived?.stats || !target.system.derived?.stats) {
    ui.notifications.warn('Both combatants need Pirate101 actor statistics.');return;
  }
  if (finiteHP(actor)<=0 || finiteHP(target)<=0) {
    ui.notifications.warn('A combatant is at 0 HP.');return;
  }
  const origin=tokenForActor(actor);
  const range=Number(weapon.system.range || 1);
  const distance=distanceBetween(origin,targetToken);
  if (setting('gridRangeChecks') && (distance==null || distance>range)) {
    ui.notifications.warn(distance==null?'Select the attacking token on this scene to check range.':`Target is ${distance} squares away; this weapon reaches ${range}.`);
    return;
  }
  const isMelee=weaponKind(weapon)==='melee';
  const defenderWeapon=readyWeapon(target,'melee');
  if (isMelee) {
    await eventReactions({event:'beforeMelee',attacker:actor,defender:target,weapon,defenderWeapon,distance});
    // First Strike can defeat the attacker before its action resolves.
    if (finiteHP(actor)<=0) {
      await ChatMessage.create({user:game.user.id,speaker:ChatMessage.getSpeaker({actor}),content:`<div class="p101-attack-card"><h3>${safe(actor.name)}'s attack was interrupted</h3><p>Attacker reached 0 HP before its basic attack.</p></div>`});
      return;
    }
  }
  const result=resolveBasicAttack({attacker:actor.system.derived.stats,defender:target.system.derived.stats,
    weapon:weapon.system.toObject(),rules:game.pirate101.rules});
  const auto=setting('autoDamage');
  const hp=await applyDamage(target,result,auto);
  if (auto && result.hit.hit && result.damage>0 && !target.isOwner)
    ui.notifications.warn('Damage preview only: you do not own the target actor.');
  await postAttack(actor,target,weapon,result,hp.applied,hp.before,hp.after,
    `<p>Distance: ${distance??'not checked'}${distance==null?'':' squares'}</p>`);
  if (result.hit.hit) await eventReactions({event:'afterHit',attacker:actor,defender:target,weapon,
    defenderWeapon,distance});
  else await eventReactions({event:'afterMiss',attacker:actor,defender:target,weapon,
    defenderWeapon,distance});
}
/** Overwatch prototype: GM-only when a token's final location ENTERS the 2-square radius.
 * It does not intercept individual intermediate squares or stop movement.
 */
export function registerMovementReactions() {
  Hooks.on('preUpdateToken',(doc,change)=>{
    if (change.x===undefined && change.y===undefined) return;
    priorTokenPosition.set(doc.uuid,{x:doc.x,y:doc.y,width:doc.width,height:doc.height});
  });
  Hooks.on('updateToken',async(doc,change)=>{
    const previous=priorTokenPosition.get(doc.uuid);
    priorTokenPosition.delete(doc.uuid);
    if (!previous || (change.x===undefined && change.y===undefined)) return;
    if (!game.user.isGM || (game.users.activeGM && game.users.activeGM.id !== game.user.id)) return;
    if (!setting('epicReactions') || !setting('movementReactions')) return;
    if (!game.combat?.started || !canvas?.scene || doc.parent?.id!==canvas.scene.id) return;
    if (doc.hidden || !doc.actor || finiteHP(doc.actor)<=0) return;
    if (moveProcessing.has(doc.uuid)) return;
    moveProcessing.add(doc.uuid);
    try {
      const g=Number(canvas.grid?.size||100);
      const watchers=canvas.tokens.placeables.filter(t=>t.id!==doc.id && t.actor && !t.document.hidden &&
        finiteHP(t.actor)>0 && eligibleEnemies(t.document,doc) && readyWeapon(t.actor,'ranged'));
      for (const watcher of watchers) {
        if (finiteHP(doc.actor)<=0) break;
        const before=tokenDistance(watcher.document,previous,g);
        const after=tokenDistance(watcher.document,doc,g);
        if (after==null || before==null || isObstructed(watcher.document,doc)) continue;
        await eventReactions({event:'movementEnter',attacker:watcher.actor,defender:doc.actor,
          weapon:readyWeapon(watcher.actor,'ranged'),defenderWeapon:null,distance:after,priorDistance:before});
      }
    } catch(err) {console.error('Pirate101 overwatch reaction failed',err);ui.notifications.error(`Overwatch: ${err.message}`);}
    finally {moveProcessing.delete(doc.uuid);}
  });
}
