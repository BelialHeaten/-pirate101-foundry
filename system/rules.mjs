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
  comparisonMode: "off", // off by default until exact official curve is known
  comparisonPointsPerPercent: 4, // homebrew approximation: +1% per 4-point advantage
  comparisonMaxPercent: 25,
  criticalMode: "off", // off, manual, or random (user-configured homebrew rates)
  criticalChances: {super: 5, mega: 2, epic: 1}, // homebrew test defaults; NOT verified official rates
  criticalTier: "none", // none, super, mega, epic (manual testing)
  criticalMultipliers: {super: 1.33, mega: 1.67, epic: 2}, // community estimates, not verified exact
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
/** Comparison bonus is documented up to 25%, but the exact curve is unknown.
 * This opt-in linear approximation is explicitly homebrew. */
export function attributeComparison(attackerStats, defenderStats, attribute, rules = {}) {
  const cfg = mergeRules(rules);
  const difference = number(attackerStats[attribute]) - number(defenderStats[attribute]);
  const percent = cfg.comparisonMode === "linear" ? clamp(Math.floor(difference / Math.max(1, number(cfg.comparisonPointsPerPercent, 4))), 0, number(cfg.comparisonMaxPercent, 25)) : 0;
  return {attribute, difference, percent, mode: cfg.comparisonMode};
}
export function applyCritical(damage, rules = {}, rng = Math.random) {
  const cfg = mergeRules(rules);
  let tier = "none";
  if (cfg.criticalMode === "manual") {
    tier = ["super", "mega", "epic"].includes(cfg.criticalTier) ? cfg.criticalTier : "none";
  } else if (cfg.criticalMode === "random") {
    // Rates are user-configured percentages, with Epic taking priority, then Mega, then Super.
    const rates = ["epic", "mega", "super"].map(t => clamp(number(cfg.criticalChances?.[t]), 0, 100));
    const total = rates.reduce((a,b) => a+b, 0);
    if (total > 100) throw new Error("Combined critical chances must not exceed 100%.");
    const roll = rng() * 100;
    if (roll < rates[0]) tier = "epic";
    else if (roll < rates[0] + rates[1]) tier = "mega";
    else if (roll < total) tier = "super";
  }
  const multiplier = tier === "none" ? 1 : Math.max(0, number(cfg.criticalMultipliers?.[tier], 1));
  return {tier, multiplier, damage: Math.floor(number(damage) * multiplier)};
}
/** Dry-run combat calculation; no actor mutation and no unsupported crit assumption. */
export function resolveBasicAttack({attacker, defender, weapon, rules = {}, bonuses = {}, rng = Math.random}) {
  const hit = rollHit(attacker, defender, rules, bonuses, rng);
  if (!hit.hit) return {hit, damage: 0, critical: null, note: "Miss: critical roll skipped"};
  const damageRoll = rollWeaponDamage(attacker, weapon, rules, rng);
  const comparison = attributeComparison(attacker, defender, damageRoll.attribute, rules);
  const comparedDamage = Math.floor(damageRoll.rolled * (1 + comparison.percent / 100));
  const critical = applyCritical(comparedDamage, rules, rng);
  return {hit, damageRoll, comparison, critical, damage: applyDefense(critical.damage, defender, weapon.damageType ?? "physical", rules),
    note: "Attribute comparison is opt-in homebrew approximation; critical rates and multipliers are experimental; Armor/Resist and Rough remain provisional."};
}
