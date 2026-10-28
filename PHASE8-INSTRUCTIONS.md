# Phase 8 — Epic Talent Reaction Prototype (v0.8.0)

## Installation
1. Back up your Forge world.
2. Extract this ZIP and upload its *contents* to the root of your existing GitHub repository (preserve the `system/`, `templates/`, and `tests/` folders). Commit.
3. On GitHub Releases, create a release with tag `v0.8.0` and attach the ZIP as `pirate101-foundry-phase8.zip` (exact spelling).
4. Verify `system.json` on the repository's main branch says `0.8.0` and the `download` URL ends in `/v0.8.0/pirate101-foundry-phase8.zip`.
5. In Forge/Foundry Setup, update the system, then launch the world.

## First test: Relentless
1. Equip a melee weapon (range 1) on your Test Buccaneer.
2. Add a **Talent** item named exactly `Relentless` (rank 1).
3. In Game Settings > Configure Settings > Pirate101 Flexible Rules, enable **Epic Talent reactions (Phase 8 experimental)**.
4. For a guaranteed reaction test, set **Epic Talent reaction chance at rank 1 (%)** to **100**. Turn Force Critical off if you want simpler numbers.
5. Target Training Dummy and attack until the basic attack hits. The chat should show the basic attack and a separate `RELENTLESS` follow-up attack. The follow-up rolls its own hit and damage; it cannot trigger another reaction.

## Second test: Riposte
1. Give Training Dummy a melee weapon (range 1), equip it, and add a **Talent** item named exactly `Riposte` (rank 1).
2. Attack the dummy until the initial attack misses. The chat should show a separate `RIPOSTE` counterattack against your Buccaneer.
3. For automatic HP reduction on Riposte, the user initiating the attack must have ownership permission for the Buccaneer; otherwise reaction damage is skipped. GM testing is recommended.

## Limits / important notes
- **Only one reaction can follow each manually initiated attack**; no reaction-to-reaction chains. Relentless triggers after a melee hit; Riposte triggers after a melee miss. Other talents are not implemented.
- **This prototype does not track per-round uses, distance on the grid, line of sight, or combat turn economy.** It only checks weapon range values and equipped status. Don't use it as a final campaign combat ruleset.
- Rank 1 defaults to a 20% trigger chance, +10 percentage points per rank, capped at 100%. These are homebrew test values, not verified Pirate101 rates.
- Existing critical and damage calculations remain experimental. The Force Critical setting affects reaction attacks too.
- Automatic HP reduction still requires the existing **Automatically apply basic-attack damage** setting and ownership permission.
- Use GM-controlled dummy actors for testing. Report the chat output of both reaction types before further changes.
