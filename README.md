## Phase 8 (v0.8.0)

Experimental one-step Relentless and Riposte reactions, disabled by default. See PHASE8-INSTRUCTIONS.md. Does not implement per-round limits, grid distance checks, or official talent probabilities.

# Pirate101 Flexible Rules — Phase 1 (Foundry v13)

Unofficial, community-built, configurable stat-engine foundation. No copyrighted game assets included.

## Install on The Forge

1. Unzip the package, keeping the `pirate101-foundry` folder intact.
2. Package the **contents** of that folder into a ZIP with `system.json` at ZIP root, or install the unpacked folder in a Foundry `Data/systems/pirate101-flex` location if self-hosting.
3. In The Forge, use its custom system/package import workflow to upload the system ZIP (available options depend on Forge account and interface).
4. Select **Pirate101 Flexible Rules** when creating a world. Use Foundry v13.
5. Create a Pirate, Companion, Enemy, Boss, or Summon actor; create weapons and equipment items.

## Data model

Actor types: `pirate`, `companion`, `enemy`, `boss`, `summon`.
Item types: `weapon`, `equipment`, `talent`, `power`, `effect`.
Actor source fields: `system.class`, `system.level`, `system.experience`, `system.base.*`, `system.health.value`, `system.resources.*`, `system.traits`, `system.tags`, `system.notes`.
Derived output: `actor.system.derived` (computed, do not persist).

Item modifiers: `[{stat:'strength', value:5, enabled:true, condition:''}]`.
Weapons: `system.attribute` is explicit `strength|agility|will`, `system.damage.min/max`, `system.damageType`.

## Console API

Open browser developer console in a running world:

```js
const r = game.pirate101;
r.hitChance({accuracy:15}, {dodge:20});
r.weaponDamageRange({strength:75, rough:0}, {attribute:'strength', damage:{min:40,max:60}});
r.resolveBasicAttack({attacker:{accuracy:15,strength:75,rough:0},defender:{dodge:20,armor:10},weapon:{attribute:'strength',damage:{min:40,max:60}},rng:Math.random});
```

The calculation engine is exposed for macros, but does **not** automatically update HP or resolve combat turns.

## Fidelity / known limitations

- The base accuracy expression `75 + Accuracy - Dodge` and `+1 weapon damage per 5 governing primary attribute points` are implemented as initial documented assumptions; verify against the game version and situational modifiers you want to emulate.
- Rough is currently **flat** by default, a placeholder rule pending verification; it can be disabled using `roughMode:'none'`.
- Armor and Resist flat reduction are **provisional**, not asserted to be exact Pirate101 combat math. Change `armorMode`/`resistMode` to `none`, `flat`, or `percent`.
- Crits, Epic Talent triggers, primary-attribute comparison effects, power-specific calculations, hit guarantees, damage-over-time, armor penetration, shields, buffs by duration, movement, initiative, and AI are NOT yet implemented.
- No custom actor/item sheets yet. Foundry's default document interfaces may not expose all custom data elegantly; use console/macros until Phase 2.
- Conditional modifiers are included only if a matching context is provided to the pure `modifierTotal` function. `deriveStats` intentionally uses unconditional modifiers only.
- System settings are registered as hidden configuration to prevent exposing raw object editors to GMs. Advanced changes can be made via `game.settings.set('pirate101-flex','rules',{...game.pirate101.rules,armorMode:'none'})`.

## Testing

With Node.js 20+: `node --test tests/rules.test.mjs`.

This is an early **developer scaffold**, not a complete playable game system. Foundry/Forge runtime compatibility must be validated in an actual v13 world.


## Phase 3
Compact actor tabs, editable item sheets, equipment slot assignment, stat modifier entry, rank and use fields. See PHASE3-INSTRUCTIONS.md.

## Phase 7
Adds configurable critical modes (off, forced Super/Mega/Epic, experimental random), tier chat display, and regression tests. See PHASE7-INSTRUCTIONS.md.
