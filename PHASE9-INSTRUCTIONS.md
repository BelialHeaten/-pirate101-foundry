# Phase 9 — Expanded Epic Talents & Grid Combat (v0.9.0)

## Install / update (The Forge + Foundry v13)

1. **Back up the Pirate101 world.** Use a testing world where possible.
2. Extract `pirate101-foundry-phase9.zip`; upload the **contents**, not a parent directory, to the root of `BelialHeaten/-pirate101-foundry` on GitHub. Preserve `system/`, `templates/`, `tests/`.
3. Verify the repository-root `system.json` reads `"version": "0.9.0"` and its download URL points to `v0.9.0/pirate101-foundry-phase9.zip`.
4. Create a **published GitHub Release** tagged exactly `v0.9.0`. Upload the release asset under the filename **`pirate101-foundry-phase9.zip`**.
5. Test the public download URL in a browser before updating Foundry:
   `https://github.com/BelialHeaten/-pirate101-foundry/releases/download/v0.9.0/pirate101-foundry-phase9.zip`
6. Stop the world on Forge, update the Pirate101 system in Foundry Setup, then launch the world and verify 0.9.0.

**Do not delete the system or its world to resolve an update error.** The release file, manifest URL, and `system.json` syntax must all match.

## Features added

- **First Strike:** defender with melee weapon reacts before an incoming adjacent melee attack. If it reduces the initiating attacker to 0 HP, the original attack is canceled.
- **Vengeance Strike:** defender with equipped melee weapon reacts immediately after receiving a successful melee attack.
- **Burst Fire:** attacker with equipped ranged weapon can follow up a successful ranged attack.
- **Overwatch (optional):** after an opposing token moves from outside to inside the configured radius (2 squares by default), the active GM checks for ranged Overwatch responses. Only while Foundry Combat has started; must have an equipped ranged weapon reaching the target; respects line-of-sight obstruction (where supported); movement completes first.
- Preserves **Relentless** and **Riposte**. All reactions roll their own hit and damage and cannot generate further reactions.
- **Grid range validation:** when enabled, standard weapon attacks cannot exceed the weapon's `range`. Melee reaction targets must be adjacent. Touching squares are distance 1, including when large tokens occupy multiple squares.
- **Rank uses in active Combat:** Rank 1 defaults to once per round per talent; Rank 2+ defaults to three per round. Different talent types have independent counters. Counters reset when the encounter round changes. Outside Combat, limits are not applied to make testing easier.

## Settings

In **Game Settings → Configure Settings → Pirate101 Flexible Rules**:

- `Epic Talent reactions (Phase 9 experimental)`: enable.
- `Epic Talent reaction chance at rank 1 (%)`: **100** for deterministic testing.
- `Additional reaction chance per talent rank (%)`: 0 while testing.
- `Automatically apply basic-attack damage`: enable for HP tests.
- `Enforce weapon range and grid distance`: enable (default). Select your attacking token on the scene.
- `Rank 1 Epic Talent uses per combat round`: default 1.
- `Rank 2+ Epic Talent uses per combat round`: default 3.
- `Overwatch on enemy movement (experimental)`: disable until the movement test; then enable.
- `Overwatch entry radius (squares)`: 2.
- `Critical hit mode`: Off for predictable damage tests; enable later for interactions.

## Controlled scenario tests (GM account)

**A. Baseline regression:** Adjacent Buccaneer with Relentless Rank 1 attacks adjacent Dummy with Riposte Rank 1. Verify normal hit → Relentless and miss → Riposte, independent HP updates.

**B. First Strike:** Give Dummy a melee weapon and `First Strike` Talent Rank 1. Buccaneer initiates adjacent melee attack. Expect `FIRST-STRIKE` reaction chat **before** the normal attack. Give attacker only 1 HP and test that a lethal First Strike cancels the original attack.

**C. Vengeance Strike:** Remove First Strike; give Dummy `Vengeance Strike` Talent Rank 1. On a successful incoming melee hit expect the original damage, then `VENGEANCE-STRIKE` counter damage. Give Buccaneer Relentless too; expect order: original attack → Vengeance Strike → Relentless, provided both survive.

**D. Burst Fire:** Create a Musketeer, equip a range-3 weapon (weapon `range` field), and add `Burst Fire` Talent Rank 1. Attack from 2 squares away. On hit, expect `BURST-FIRE` follow-up; on miss, no follow-up. Ranged attacks do not trigger Riposte or Vengeance Strike.

**E. Range:** Melee target 2 squares away should be blocked before a chat attack. Range-3 ranged weapon should hit a target at 2–3 squares but be blocked at 4 squares (regardless of accuracy).

**F. Round limits:** Add Buccaneer and Dummy to an active Foundry Combat encounter. Set `Relentless` Rank 1 and chance 100%. Make two qualifying hits in the **same round**; expect only one Relentless reaction. Advance to next round; reaction available again. Change to Rank 2, repeat four qualifying hits in one round; expect at most three triggers. These counts are per actor and per talent kind.

**G. Overwatch:** Start Foundry Combat with a friendly Musketeer (range-3 weapon, `Overwatch` Rank 1) and a hostile token. Set token dispositions Friendly (+1) and Hostile (-1). Enable `Overwatch on enemy movement`. Move hostile token from 4 to 2 squares from the Musketeer. Expect one `OVERWATCH` ranged attack and HP change if it hits. Moving from 2 to 1 square does **not** trigger again because the token was already inside the radius. Overwatch runs GM-side; test while GM is connected.

**H. Safety:** Disable auto damage to confirm chat-only previews. Try an attack without target ownership as a player; expect no unauthorized HP mutation. Verify a killed unit cannot retaliate. Try a different scene and an out-of-range target: no ranged reaction should occur.

## Constraints / deliberate non-features

- All Phase 9 automatic reaction chances and rank-scaling percentages are **test/homebrew values**, not official Pirate101 probabilities.
- One-step depth: a reaction cannot trigger a reaction. This is a safety simplification, not a full recreation of the original game's attack back-and-forth.
- Rank 3+ special effects, knockback, debuffs, stealth/hidden rules, critical interaction details, power-specific interactions, and advanced attack queue are not yet implemented.
- Overwatch triggers after the token's completed movement, **not at individual path squares**, and cannot interrupt movement. It requires an active GM and Combat encounter. Movement in another scene, movement by neutral/friendly tokens, or hidden tokens is ignored.
- Per-round uses are tracked only during active Foundry Combat. When outside Combat, repeated attacks can trigger unlimited times for isolated tests.
- Damage and critical formulas from earlier phases were intentionally **not changed**. Official game updates changed primary-stat scaling and critical ordering; these need a separate fidelity audit before describing this system as an exact Pirate101 simulation.
- Only participants with appropriate Foundry ownership can have their HP/flags changed. Do not grant extra permissions or create a GM socket escalation for ordinary player attacks.

## Developer tests

With Node.js installed:

```bash
node --test tests/*.test.mjs
node --check system/main.mjs
node --check system/phase9-combat.mjs
node --check system/reactions.mjs
```

All automated tests are complementary to—not substitutes for—tests inside Foundry v13 on Forge.
