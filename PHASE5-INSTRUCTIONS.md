# Pirate101 v0.5.0 — Basic HP application

This is an incremental prototype, not a verified Pirate101 combat simulator.

## Upgrade
1. Back up your Forge world.
2. Upload the CONTENTS of this archive to your GitHub repository, replacing old files.
3. Commit, create a `v0.5.0` GitHub release, and attach the original `pirate101-foundry-phase5.zip`.
4. Update the system in Foundry Setup and verify v0.5.0.

## Test
1. First test with **Automatically apply basic-attack damage** OFF (Foundry world Settings → Configure Settings → System Settings). The attack should only post a preview.
2. As GM, enable that setting. Target a test enemy with known HP, equip a weapon, and attack. A hit should subtract the provisional damage from the target's HP, not below zero. A miss should not change HP.
3. Disable it again if you do not want automated HP changes.

## Known limits
- The calculation uses provisional flat Armor/Resist and Rough rules. It is NOT verified to match Pirate101 precisely.
- No automatic healing, crits, chains, range/line-of-sight validation, movement, or GM socket mediation.
- Only users with ownership permission over the target can apply damage. Others get preview-only chat messages.
- The attack is not authoritative against malicious clients and is for trusted table use.
- No automatic KO/deletion; HP bottoms at zero.
