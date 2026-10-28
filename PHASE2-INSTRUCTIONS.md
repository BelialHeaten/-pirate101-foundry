# Phase 2 (v0.2.0) — character sheet preview

This is an **untested Foundry v13 prototype** using the legacy ActorSheet API. It may require a compatibility fix on your exact v13 build. It registers a sheet for all five actor types, exposes editable base statistics, displays derived totals, and provides tabs for weapons/equipment, powers, talents, and notes. Item editors are Foundry's default item sheets; a custom item sheet is not included yet. Combat automation, item modifier editing UI, full Pirate101 formulas and talent triggers are not implemented.

## Publish without overwriting your original release
1. Extract this ZIP locally. Upload its contents to your existing GitHub repository, replacing `system.json`, `system/main.mjs`, and `system/styles.css` and adding `templates/actor-sheet.hbs` and this file.
2. Commit the files to `main`.
3. On GitHub create a new release with tag `v0.2.0` and attach the **unaltered** `pirate101-foundry-phase2.zip` as a release asset.
4. In Foundry Setup > Game Systems, update the system; if it does not offer an update, uninstall only the *system package* and reinstall with the manifest URL. Do not delete your world.
5. Open your world, open Test Pirate, and check Sheet Configuration > This Sheet. Select Pirate101 Character Sheet if it is not already the default.

Manifest URL: https://raw.githubusercontent.com/BelialHeaten/-pirate101-foundry/main/system.json

**Important:** The ZIP and the `system.json` on GitHub must both be version 0.2.0. Do not update the manifest before publishing the release asset or Foundry may fail to download it.
