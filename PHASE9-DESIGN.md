# Phase 9 — Reaction Engine Design

## Goals

Bring the prototype beyond two individual reaction scripts into a small combat event pipeline that can grow into Pirate101-style tactical combat without hardwiring every talent into the actor sheet.

## Event timeline

1. **Validate** the attacker, equipped weapon, selected target and weapon range.
2. **Before-melee event:** First Strike on defender (if applicable). If it defeats attacker, cancel initial attack.
3. **Initial attack:** Resolve accuracy, damage, comparison and critical with the existing Phase 7 calculation engine. Apply HP if permitted.
4. **On a melee hit:** Vengeance Strike on defender, then Relentless on attacker, provided each still has HP and uses. **On a ranged hit:** Burst Fire on attacker.
5. **On a melee miss:** Riposte on defender.
6. **Stop:** Reaction attacks do not generate new events. This is a bounded depth-1 implementation; no nested attack tree.

A separate **movementEnter** event after a token move can produce Overwatch attacks. This event is processed by the active GM only, while a Combat encounter is running.

## Shared trigger contract

The pure planner (`system/reactions.mjs`) inspects: event type, attacker/defender and equipped weapons, melee or ranged classification, token distance, talent rank, used activations this round, chance configuration and RNG. It returns candidate reactions; the Foundry adapter (`system/phase9-combat.mjs`) resolves ownership, updates counters/HP and posts chat messages. The pure planner never writes to a Foundry document.

## State and round limits

When a Combat encounter has started, actor flags store `{round: '<combat-id>:<round-number>', counts: {'relentless': 1, ...}}`. Rank 1 normally permits one use; Rank 2+ three; both limits are adjustable via settings. On a new Combat round, the old counts are ignored. Outside Combat, no use limit is applied, to support repeated manual tests.

## Geometry

The code uses square-grid distances between occupied token rectangles, so adjacent squares on a large 2x2 token are valid melee contact. Distance validation is a gameplay prototype, not a full tactical pathfinder: cover, elevation, threatened squares, and invisible attackers will come later.

## Explicit abstractions and limitations

- Melee weapons: `range` 1; ranged weapons: `range` greater than 1. Dedicated pirate weapon families (Slashy, Shooty, Staffy, hybrid categories) are future data-model work.
- Basic reaction rates are configurable with homebrew defaults inherited from Phase 8. Official trigger probability is not claimed.
- Higher-rank Epic Talent extra effects are not yet implemented, only additional uses/chance scaling.
- Overwatch is a post-movement event: it observes the final location, not each square the token walked through; it cannot stop movement or change its path.
- No GM socket/permission bypass. GM testing recommended when enemies react. In multiplayer, player-initiated actions can preview without modifying unauthorized actor documents.
- This is not a complete Pirate101 resolution engine; official rules changed multiple times and require a version-specific fidelity decision.

## Future architecture options

- Reactions as queued `AttackEvent` records with bounded maximum depth, priority and per-round counts, allowing authentic multi-step chains later.
- Actor-level `weaponCategory` and `attackType` instead of classifying all >1 range weapons as Shootys.
- Stealth, movement path sampling, interception/knockback, status duration and correct round/turn semantics.
- A versioned rules preset for documented Pirate101-era changes to primary-stat damage scaling and critical strength ordering.
- Sandbox utilities to spawn fixed-stat training pairs and automatically replay combat scenarios in Foundry.

## Background reference notes

- Pirate101's official player guide says Rank 1 Epic Talents can activate at most once per round, with more activations possible for higher ranks.
- The May 2014 official update changed the order of critical strength and the primary-stat damage rule. Existing prototype settings are not automatically overwritten in Phase 9.

Official references:
- https://www.pirate101.com/free_game/players_guide/pirate/talents_abilities
- https://www.pirate101.com/free_game/update_notes/may11
- https://www.pirate101.com/forum/a-pirates-life/struggling-to-understand-some-things-8ad6a416461de43f0146394987b750c1
