/** Pure, dependency-free calculation layer. All values are numeric unless noted. */
export const ATTRIBUTES = ["strength", "agility", "will"];
export const STAT_KEYS = ["strength", "agility", "will", "accuracy", "dodge", "armor", "resist", "rough", "spooky", "critical", "movement", "maxHealth"];
export const DEFAULT_RULES = Object.freeze({
  accuracyBase: 75,
  accuracyMin: 0,
  accuracyMax: 100,
  primaryDamagePerPoints: 5,
  primaryDamagePerStep: 1,
  primaryDamageRounding: "floor",
  damageFloor: 0,
  armorMode: "flat", // provisional: configurable, not claimed to be exact Pirate101
  resistMode: "flat", // provisional
  roughMode: "flat", // provisional
  critMode: "manual", // no unsupported critical formula assumed
  clampHealth: true
});
export function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
export function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
export function mergeRules(override = {}) { return {...DEFAULT_RULES, ...override}; }
export function modifierTotal(modifiers = [], stat, context = {}) {
  return modifiers.filter(m => m && m.enabled !== false && m.stat === stat && (!m.condition || context[m.condition] === true))
    .reduce((sum, m) => sum + number(m.value), 0);
}
export function deriveStats(actor = {}, items = [], effects = [], rules = {}) {
  const cfg = mergeRules(rules);
  const base = actor.base ?? {};
  const allModifiers = [...items.filter(i => i.equipped !== false).flatMap(i => i.modifiers ?? []), ...effects.flatMap(e => e.modifiers ?? [])];
  const stats = Object.fromEntries(STAT_KEYS.map(k => [k, number(base[k]) + modifierTotal(allModifiers, k)]));
  const maxHealth = Math.max(1, stats.maxHealth);
  const health = clamp(number(actor.health?.value, maxHealth), 0, cfg.clampHealth ? maxHealth : Infinity);
  return {stats, health: {value: health, max: maxHealth}, modifiers: allModifiers};
}
export function weaponAttribute(weapon = {}) {
  // Hybrid weapons must explicitly declare the governing attribute; do not guess.
  return ATTRIBUTES.includes(weapon.attribute) ? weapon.attribute : null;
}
export function primaryDamageBonus(attributeValue, rules = {}) {
  const cfg = mergeRules(rules);
  const divisor = Math.max(1, number(cfg.primaryDamagePerPoints, 5));
  const steps = number(attributeValue) / divisor;
  const rounded = cfg.primaryDamageRounding === "ceil" ? Math.ceil(steps) : cfg.primaryDamageRounding === "round" ? Math.round(steps) : Math.floor(steps);
  return rounded * number(cfg.primaryDamagePerStep, 1);
}
export function hitChance(attackerStats, defenderStats, rules = {}, bonuses = {}) {
  const cfg = mergeRules(rules);
  const raw = number(cfg.accuracyBase, 75) + number(attackerStats.accuracy) - number(defenderStats.dodge)
    + number(bonuses.accuracy) - number(bonuses.dodge);
  return {raw, chance: clamp(raw, number(cfg.accuracyMin, 0), number(cfg.accuracyMax, 100))};
}
export function rollHit(attackerStats, defenderStats, rules = {}, bonuses = {}, rng = Math.random) {
  const {raw, chance} = hitChance(attackerStats, defenderStats, rules, bonuses);
  const roll = Math.floor(rng() * 100) + 1;
  return {raw, chance, roll, hit: roll <= chance};
}
export function weaponDamageRange(attackerStats, weapon, rules = {}) {
  const cfg = mergeRules(rules);
  const attribute = weaponAttribute(weapon);
  if (!attribute) throw new Error("Weapon requires an explicit governing attribute: strength, agility or will.");
  const bonus = primaryDamageBonus(attackerStats[attribute], cfg);
  const rough = cfg.roughMode === "flat" ? number(attackerStats.rough) : 0;
  const min = number(weapon.damage?.min) + bonus + rough;
  const max = number(weapon.damage?.max) + bonus + rough;
  return {min: Math.max(0, Math.min(min, max)), max: Math.max(0, Math.max(min, max)), attribute, primaryBonus: bonus, roughBonus: rough};
}
export function rollWeaponDamage(attackerStats, weapon, rules = {}, rng = Math.random) {
  const range = weaponDamageRange(attackerStats, weapon, rules);
  const rolled = range.min + Math.floor(rng() * (range.max - range.min + 1));
  return {...range, rolled};
}
export function applyDefense(damage, defenderStats, damageType = "physical", rules = {}) {
  const cfg = mergeRules(rules);
  const stat = damageType === "magical" ? "resist" : "armor";
  const mode = damageType === "magical" ? cfg.resistMode : cfg.armorMode;
  const defense = Math.max(0, number(defenderStats[stat]));
  if (mode === "none") return Math.max(number(cfg.damageFloor), number(damage));
  if (mode === "percent") return Math.max(number(cfg.damageFloor), Math.floor(number(damage) * (1 - clamp(defense, 0, 100) / 100)));
  return Math.max(number(cfg.damageFloor), number(damage) - defense);
}
/** Dry-run combat calculation; no actor mutation and no unsupported crit assumption. */
export function resolveBasicAttack({attacker, defender, weapon, rules = {}, bonuses = {}, rng = Math.random}) {
  const hit = rollHit(attacker, defender, rules, bonuses, rng);
  if (!hit.hit) return {hit, damage: 0, critical: null, note: "Critical and epic talent processing not yet implemented"};
  const damageRoll = rollWeaponDamage(attacker, weapon, rules, rng);
  return {hit, damageRoll, damage: applyDefense(damageRoll.rolled, defender, weapon.damageType ?? "physical", rules), critical: null,
    note: "Provisional damage pipeline; primary-attribute comparison and power-specific rules are not yet implemented"};
}
