# Phase 3 installation and test

1. Upload the ZIP contents to the GitHub repository root, replacing existing files, and commit.
2. Publish GitHub release tag `v0.3.0` with `pirate101-foundry-phase3.zip` as an attached asset.
3. Confirm the repository-root `system.json` has version `0.3.0`, the unchanged manifest URL, and a download URL ending in `/v0.3.0/pirate101-foundry-phase3.zip`.
4. In Foundry Setup > Game Systems, update Pirate101 Flexible Rules. Back up the world before updating.
5. Open Test Buccaneer; check the tabs are compact. Create a weapon under Equipment; click its name to edit its slot, scaling, damage, and modifiers. Equip it and verify its stat bonus on the Stats tab. Unequip to verify removal.

Notes: Equipment slots are homebrew-configurable; one equipped item per slot is enforced by the sheet's checkbox interaction. This is not a complete inventory or combat system. No Epic Talent reaction automation yet. Armor/Resist/Rough damage rules remain provisional. New items and actor fields have not been verified in a live Forge world.
