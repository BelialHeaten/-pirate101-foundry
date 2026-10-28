/** Phase 9 reaction planner: dependency-free and deterministic when rng injected.
 * Triggers and ordering are designed for controlled Foundry tests. The exact
 * rates, damage factors, and high-rank extra effects are NOT claimed official.
 */
export const REACTION_TALENTS = Object.freeze({
  relentless:'relentless', riposte:'riposte', firstStrike:'first-strike',
  vengeanceStrike:'vengeance-strike', burstFire:'burst-fire', overwatch:'overwatch'
});
export const REACTION_EVENTS = Object.freeze({
  beforeMelee:['first-strike'],
  afterHit:['vengeance-strike','relentless','burst-fire'],
  afterMiss:['riposte'],
  movementEnter:['overwatch']
});
const ALIASES = Object.freeze({
  relentless:'relentless', riposte:'riposte',
  firststrike:'first-strike', vengeancestrike:'vengeance-strike',
  burstfire:'burst-fire', overwatch:'overwatch'
});
function normalized(value) { return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g,''); }
export function talentKind(item = {}) {
  if (item.type !== 'talent') return null;
  return ALIASES[normalized(item.system?.trigger)] || ALIASES[normalized(item.name)] || null;
}
export function findTalent(actor, kind) {
  return (actor?.items || []).find(item => talentKind(item) === kind) || null;
}
export function reactionChance(rank, base = 20, perRank = 10) {
  const value = Number(base) + (Math.max(1,Math.floor(Number(rank)||1))-1)*Number(perRank);
  return Math.min(100,Math.max(0,Number.isFinite(value)?value:0));
}
export function reactionUseLimit(rank, rank1 = 1, rank2Plus = 3) {
  return Math.max(0,Math.floor(Number(rank) >= 2 ? Number(rank2Plus) || 0 : Number(rank1) || 0));
}
export function weaponKind(weapon) {
  if (!weapon || weapon.type && weapon.type !== 'weapon' || weapon.system?.equipped === false) return null;
  const range = Number(weapon.system?.range ?? weapon.range ?? 1);
  if (!Number.isFinite(range) || range < 1) return null;
  return range <= 1 ? 'melee' : 'ranged';
}
/** Uses rectangle-edge distance so 2x2 creatures can be adjacent to 1x1 units.
 * Returns 1 for touching occupied squares, 2 if one empty square separates them.
 */
export function tokenDistance(a,b,gridSize=100) {
  if (!a || !b || !(gridSize > 0)) return null;
  const dims = t => ({x:Number(t.x),y:Number(t.y),w:Number(t.width ?? 1)*gridSize,h:Number(t.height ?? 1)*gridSize});
  const x=dims(a), y=dims(b);
  if (![x.x,x.y,x.w,x.h,y.x,y.y,y.w,y.h].every(Number.isFinite)) return null;
  const dx = Math.max(0,y.x-(x.x+x.w),x.x-(y.x+y.w));
  const dy = Math.max(0,y.y-(x.y+x.h),x.y-(y.y+y.h));
  return 1 + Math.ceil(Math.max(dx,dy)/gridSize);
}
/** Pure event planner. No flags or data mutation. A failed chance does not spend uses.
 * available uses is supplied from the runtime's current combat round state.
 */
export function planEventReactions({event,attacker,defender,weapon,defenderWeapon,
  enabled=false,depth=0,maxDepth=1,chanceBase=20,chancePerRank=10,
  uses={},rank1Uses=1,rank2Uses=3,distance=null,requireDistance=false,
  priorDistance=null,overwatchRadius=2,onlyKind=null,rng=Math.random}={}) {
  if (!enabled || depth >= maxDepth || maxDepth < 1) return [];
  const melee = weaponKind(weapon)==='melee';
  const ranged = weaponKind(weapon)==='ranged';
  const results=[];
  for (const kind of (REACTION_EVENTS[event] || []).filter(k=>!onlyKind || k===onlyKind)) {
    const owner = ['first-strike','vengeance-strike','riposte'].includes(kind) ? defender : attacker;
    const target = owner === attacker ? defender : attacker;
    const selectedWeapon = owner === attacker ? weapon : defenderWeapon;
    if (!owner || !target || !selectedWeapon) continue;
    if (kind === 'overwatch') {
      if (weaponKind(selectedWeapon) !== 'ranged' || distance == null || priorDistance == null ||
          !(priorDistance > overwatchRadius && distance <= overwatchRadius) ||
          Number(selectedWeapon.system?.range ?? selectedWeapon.range) < distance) continue;
    } else if (kind === 'burst-fire') {
      if (!ranged) continue;
    } else {
      if (!melee || weaponKind(selectedWeapon) !== 'melee') continue;
      if (requireDistance && (distance == null || distance > 1)) continue;
    }
    const talent = findTalent(owner,kind);
    if (!talent) continue;
    const rank = Math.max(1,Math.floor(Number(talent.system?.rank ?? talent.rank ?? 1)||1));
    const limit = reactionUseLimit(rank,rank1Uses,rank2Uses);
    const used = Math.max(0,Number(uses[kind])||0);
    if (used >= limit) continue;
    const chance = reactionChance(rank,chanceBase,chancePerRank);
    const roll = Math.floor(rng()*100)+1;
    if (roll > chance) continue;
    results.push({triggered:true,kind,talent:talent.name,rank,chance,roll,limit,used,
      reason:'triggered',owner,target,weapon:selectedWeapon});
  }
  return results;
}
/** Compatibility for Phase 8 tests and macros: one hit-or-miss reaction only. */
export function planReaction({hit,attacker,defender,weapon,defenderWeapon,enabled=false,maxDepth=1,depth=0,
  chanceBase=20,chancePerRank=10,rng=Math.random}={}) {
  if (!enabled || depth >= maxDepth || maxDepth <= 0) return {triggered:false,reason:'disabled-or-depth'};
  const kind=hit?'relentless':'riposte';
  const owner=hit?attacker:defender;
  const selected=hit?weapon:defenderWeapon;
  if (weaponKind(weapon)!=='melee' || weaponKind(selected)!=='melee') return {triggered:false,reason:'not-melee-or-weapon'};
  const talent=findTalent(owner,kind);
  if (!talent) return {triggered:false,reason:'no-talent'};
  const rank=Math.max(1,Math.floor(Number(talent.system?.rank ?? talent.rank ?? 1)||1));
  const chance=reactionChance(rank,chanceBase,chancePerRank);
  const roll=Math.floor(rng()*100)+1;
  return {triggered:roll<=chance,kind,talent:talent.name,rank,chance,roll,reason:roll<=chance?'triggered':'roll-failed'};
}
