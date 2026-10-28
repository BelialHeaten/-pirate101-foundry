/** Phase 8: intentionally limited one-step Epic Talent reaction planner.
 * Probabilities are homebrew test defaults, NOT verified Pirate101 rates.
 * No recursion: a reaction attack cannot generate another reaction.
 */
export const REACTION_TALENTS = Object.freeze({relentless:'relentless',riposte:'riposte'});
export function talentKind(item = {}) {
  if (item.type !== 'talent') return null;
  const raw = String(item.system?.trigger || item.trigger || item.name || '').trim().toLowerCase();
  if (raw === 'relentless' || raw === 'riposte') return raw;
  const name = String(item.name || '').trim().toLowerCase();
  return name === 'relentless' || name === 'riposte' ? name : null;
}
export function findTalent(actor, kind) {
  return (actor?.items || []).find(item => talentKind(item) === kind) || null;
}
export function reactionChance(rank, base = 20, perRank = 10) {
  return Math.min(100, Math.max(0, Number(base) + (Math.max(1,Math.floor(Number(rank)||1))-1)*Number(perRank)));
}
export function planReaction({hit, attacker, defender, weapon, defenderWeapon, enabled = false, maxDepth = 1, depth = 0, chanceBase = 20, chancePerRank = 10, rng = Math.random}) {
  if (!enabled || depth >= maxDepth || maxDepth <= 0) return {triggered:false,reason:'disabled-or-depth'};
  const kind = hit ? 'relentless' : 'riposte';
  const owner = hit ? attacker : defender;
  const selectedWeapon = hit ? weapon : defenderWeapon;
  if (!selectedWeapon || selectedWeapon.system?.equipped === false) return {triggered:false,reason:'no-equipped-weapon'};
  // Phase 8 only handles melee basic attacks; range >1 is not supported for these reactions.
  if (Number(weapon?.system?.range ?? weapon?.range ?? 1) > 1 || Number(selectedWeapon?.system?.range ?? selectedWeapon?.range ?? 1) > 1) return {triggered:false,reason:'not-melee'};
  const talent = findTalent(owner,kind);
  if (!talent) return {triggered:false,reason:'no-talent'};
  const rank = Number(talent.system?.rank ?? talent.rank ?? 1);
  const chance = reactionChance(rank,chanceBase,chancePerRank);
  const roll = Math.floor(rng()*100)+1;
  return {triggered:roll <= chance, kind, talent:talent.name, rank, chance, roll, reason:roll <= chance?'triggered':'roll-failed'};
}
