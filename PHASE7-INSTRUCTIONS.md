# Phase 7 — Critical Hits (v0.7.0)

1. Back up your Foundry world.
2. Upload the extracted ZIP contents to your GitHub repository root, replacing existing files, and commit.
3. Create GitHub release tag `v0.7.0` and attach the **ZIP file itself** as `pirate101-foundry-phase7.zip`. The manifest download URL points to that asset.
4. Update the installed system in Foundry, then launch your world.
5. Under Game Settings → Configure Settings → Pirate101 Flexible Rules, choose **Critical hit mode: Force selected tier (testing)** and **Force critical tier: Super**. Keep automatic HP damage enabled if desired.
6. Attack the Training Dummy until a hit lands. The chat card should show `Critical: SUPER` and the configured multiplier. A miss must still deal 0.
7. Repeat with Mega and Epic; then choose Off to disable criticals or Random for experimental rates.

**Important:** Critical probabilities and multipliers are configurable **homebrew test values**, not verified official Pirate101 rules. Random critical rates must total no more than 100%. Criticals are resolved only on successful hits. Epic Talent reactions are not implemented.
