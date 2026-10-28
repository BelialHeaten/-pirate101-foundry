# Phase 4 — Stable tabs and basic attack preview

1. Back up the Pirate101 world on The Forge.
2. Extract `pirate101-foundry-phase4.zip` and upload the contents to the GitHub repository root. Commit.
3. Publish a GitHub release tagged `v0.4.0` and attach the exact `pirate101-foundry-phase4.zip` file.
4. Check the repository root `system.json` points to that release ZIP and version 0.4.0.
5. In Foundry Setup > Game Systems, update Pirate101 Flexible Rules.
6. In the world, open a Pirate actor, switch to Equipment, create or equip a weapon, and verify the Equipment tab remains selected.
7. Place Pirate and Enemy tokens on a scene. Target the Enemy token, then open Pirate > Equipment and click Attack on an equipped weapon. Check the chat message.

**Limitations:** Attack is a chat-only preview; it does NOT apply HP damage. The underlying damage rules remain provisional, and no Epic Talent reaction engine is implemented. Inputs may still briefly lose focus because the sheet uses Foundry's legacy submit-on-change rerender. If an existing sheet remains open during update, close and reopen it.
