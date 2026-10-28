# Pirate101 Phase 6 — Experimental attribute comparisons

Version 0.6.0. Back up your Forge world first. Upload the contents of this package to your GitHub repository, commit, and publish a v0.6.0 release attaching `pirate101-foundry-phase6.zip`. Update the installed Foundry game system.

In **Game Settings → Configure Settings → Pirate101 Flexible Rules**, the new **Attribute comparison (experimental)** setting defaults to Off. You may opt into a *homebrew linear approximation* of +1% damage per 4 points of primary-attribute advantage, capped at +25%. The exact original curve is not verified.

The engine also exposes `attributeComparison()` and `applyCritical()` for future phases. Critical tiers are **not rolled automatically**; their multipliers are community estimates and remain disabled by default.

Test against the Training Dummy. Existing actors and weapons are preserved. Automatic HP damage still follows the previous world setting.

Limitations: Armor/Resist and Rough are still provisional; critical probabilities, chains, powers, and reactions are not implemented.
