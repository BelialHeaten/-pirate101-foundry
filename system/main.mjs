import {deriveStats, hitChance, weaponDamageRange, resolveBasicAttack, attributeComparison, applyCritical, mergeRules} from "./rules.mjs";

const DEFAULT_ACTOR = {
  class: "buccaneer", level: 1, experience: 0,
  base: {strength: 0, agility: 0, will: 0, accuracy: 0, dodge: 0, armor: 0, resist: 0, rough: 0, spooky: 0, critical: 0, movement: 4, maxHealth: 100},
  health: {value: 100}, resources: {value: 0, max: 0},
  traits: [], tags: [], notes: ""
};
const DEFAULT_ITEM = {
  description: "", equipped: false, slot: "none", modifiers: [],
  attribute: "strength", damage: {min: 1, max: 2}, damageType: "physical", range: 1,
  trigger: "", rank: 1, uses: {value: 0, max: 0}, tags: []
};

Hooks.once("init", () => {
  console.info("Pirate101 Flexible Rules | Initializing Phase 6");
  game.settings.register("pirate101-flex", "rules", {
    name: "Rules configuration (advanced)", hint: "Configurable overrides for the Phase 1 calculation engine.",
    scope: "world", config: false, type: Object, default: mergeRules()
  });
  game.settings.register("pirate101-flex", "comparisonMode", {
    name: "Attribute comparison (experimental)", hint: "Disabled by default. Linear mode uses an adjustable approximation, NOT the verified Pirate101 formula.",
    scope: "world", config: true, type: String, choices: {off:"Off (verified mechanics only)",linear:"Linear approximation (homebrew)"}, default: "off"
  });
  game.settings.register("pirate101-flex", "autoDamage", {
    name: "Automatically apply basic-attack damage", hint: "OFF by default. If enabled, attacks reduce HP only when the acting user has ownership permission for the target. Calculations are still provisional.",
    scope: "world", config: true, type: Boolean, default: false
  });
  CONFIG.Actor.dataModels = Object.fromEntries(["pirate", "companion", "enemy", "boss", "summon"].map(t => [t, PirateActorData]));
  CONFIG.Item.dataModels = Object.fromEntries(["weapon", "equipment", "talent", "power", "effect"].map(t => [t, PirateItemData]));
  game.pirate101 = {deriveStats, hitChance, weaponDamageRange, resolveBasicAttack, attributeComparison, applyCritical, mergeRules,
    get rules() {return {...game.settings.get("pirate101-flex", "rules"), comparisonMode: game.settings.get("pirate101-flex", "comparisonMode")};}};
});

const F = foundry.data.fields;
class PirateActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      class: new F.StringField({initial: "buccaneer"}),
      level: new F.NumberField({initial: 1, integer: true, min: 1}),
      experience: new F.NumberField({initial: 0, min: 0}),
      base: new F.SchemaField(Object.fromEntries(Object.entries(DEFAULT_ACTOR.base).map(([k,v]) => [k, new F.NumberField({initial: v})]))),
      health: new F.SchemaField({value: new F.NumberField({initial: 100, min: 0})}),
      resources: new F.SchemaField({value: new F.NumberField({initial: 0}), max: new F.NumberField({initial: 0})}),
      traits: new F.ArrayField(new F.StringField()),
      tags: new F.ArrayField(new F.StringField()),
      notes: new F.StringField({initial: ""})
    };
  }
  prepareDerivedData() {
    const items = this.parent.items.contents.filter(i => i.type === "equipment" || i.type === "weapon").map(i => i.system.toObject());
    const effects = this.parent.items.contents.filter(i => i.type === "effect").map(i => i.system.toObject());
    this.derived = deriveStats(this.toObject(), items, effects, game.settings.get("pirate101-flex", "rules"));
  }
}
class PirateItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new F.HTMLField({initial: ""}),
      slot: new F.StringField({initial: "none"}),
      equipped: new F.BooleanField({initial: false}),
      modifiers: new F.ArrayField(new F.SchemaField({
        stat: new F.StringField({initial: "strength"}), value: new F.NumberField({initial: 0}),
        enabled: new F.BooleanField({initial: true}), condition: new F.StringField({initial: ""})
      })),
      attribute: new F.StringField({initial: "strength"}),
      damage: new F.SchemaField({min: new F.NumberField({initial: 1}), max: new F.NumberField({initial: 2})}),
      damageType: new F.StringField({initial: "physical"}),
      range: new F.NumberField({initial: 1, min: 0}),
      trigger: new F.StringField({initial: ""}),
      rank: new F.NumberField({initial: 1, integer: true, min: 1}),
      uses: new F.SchemaField({value: new F.NumberField({initial: 0}), max: new F.NumberField({initial: 0})}),
      tags: new F.ArrayField(new F.StringField())
    };
  }
}

// Phase 2: simple actor sheet; the rules engine remains independent of presentation.
class Pirate101ActorSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["pirate101-flex", "sheet", "actor"],
      template: "systems/pirate101-flex/templates/actor-sheet.hbs",
      width: 790, height: 690, resizable: true, submitOnChange: true, closeOnSubmit: false
    });
  }
  getData(options = {}) {
    const data = super.getData(options);
    const system = this.actor.system;
    const derived = system.derived ?? deriveStats(system.toObject());
    const labels = {strength:"Strength", agility:"Agility", will:"Will", accuracy:"Accuracy", dodge:"Dodge", armor:"Armor", resist:"Resist", rough:"Rough", spooky:"Spooky", critical:"Critical", movement:"Movement", maxHealth:"Max Health"};
    return {...data, system, derived, classes: {buccaneer:"Buccaneer", musketeer:"Musketeer", privateer:"Privateer", swashbuckler:"Swashbuckler", witchdoctor:"Witchdoctor", custom:"Custom"},
      statRows: Object.entries(labels).map(([key,label]) => ({key,label,base:system.base[key],total:derived.stats[key]})),
      equipment: this.actor.items.filter(i => ["weapon","equipment"].includes(i.type)).map(i => ({id:i.id,name:i.name,img:i.img,type:i.type,slot:i.system.slot,equipped:i.system.equipped,bonuses:i.system.modifiers.filter(m=>m.enabled).map(m=>`${m.stat} ${m.value>=0?"+":""}${m.value}`).join(", ")})),
      powers: this.actor.items.filter(i => i.type === "power"), talents: this.actor.items.filter(i => i.type === "talent"), slots: {none:"Unassigned",weapon:"Weapon",hat:"Hat",outfit:"Outfit",boots:"Boots",amulet:"Amulet",ring:"Ring",totem:"Totem",pet:"Pet",other:"Other"}};
  }
  async _render(force, options) {
    await super._render(force, options);
    const tab = this._activePirateTab ?? "stats";
    const html = this.element;
    html.find("[data-tab]").removeClass("active");
    html.find(`[data-tab="${tab}"]`).addClass("active");
    html.find("[data-panel]").prop("hidden", true);
    html.find(`[data-panel="${tab}"]`).prop("hidden", false);
  }
  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-tab]").on("click", ev => {
      const tab = ev.currentTarget.dataset.tab;
      this._activePirateTab = tab;
      html.find("[data-tab]").removeClass("active");
      html.find(`[data-tab="${tab}"]`).addClass("active");
      html.find("[data-panel]").prop("hidden", true);
      html.find(`[data-panel="${tab}"]`).prop("hidden", false);
    });
    html.find("[data-create]").on("click", async ev => {
      const type = ev.currentTarget.dataset.create;
      this._activePirateTab = type === "weapon" || type === "equipment" ? "equipment" : type === "power" ? "powers" : "talents";
      await this.actor.createEmbeddedDocuments("Item", [{name:`New ${type}`,type}]);
    });
    html.find("[data-open]").on("click", ev => this.actor.items.get(ev.currentTarget.dataset.open)?.sheet.render(true));
    html.find("[data-attack]").on("click", async ev => {
      const weapon = this.actor.items.get(ev.currentTarget.dataset.attack);
      const target = Array.from(game.user.targets)[0];
      if (!weapon || !target?.actor) return ui.notifications.warn("Target one enemy token first.");
      if (!weapon.system.equipped) return ui.notifications.warn("Equip the weapon first.");
      const a = this.actor.system.derived?.stats;
      const d = target.actor.system.derived?.stats;
      if (!a || !d) return ui.notifications.warn("Both actors must use Pirate101 actor types.");
      if (this._attackBusy) return;
      this._attackBusy = true;
      try {
      const result = resolveBasicAttack({attacker:a, defender:d, weapon:weapon.system.toObject(), rules:game.pirate101.rules});
      const esc = foundry.utils.escapeHTML;
      const title = `${esc(this.actor.name)} attacks ${esc(target.name)} with ${esc(weapon.name)}`;
      const damage = result.damage;
      const oldHP = Number(target.actor.system.health.value);
      const newHP = Math.max(0, oldHP - damage);
      const apply = game.settings.get("pirate101-flex", "autoDamage");
      let applied = false;
      if (apply && result.hit.hit && damage > 0) {
        if (!target.actor.isOwner) {
          ui.notifications.warn("Damage preview only: you lack permission to edit the target. Ask the GM to apply it.");
        } else {
          await target.actor.update({"system.health.value":newHP});
          applied = true;
        }
      }
      const comparisonText = result.comparison ? `<p>Attribute comparison: ${result.comparison.difference >= 0 ? "+" : ""}${result.comparison.difference} (${result.comparison.percent}% bonus; ${result.comparison.mode})</p>` : "";
      const content = `<div class="p101-attack-card"><h3>${title}</h3><p>Hit roll: ${result.hit.roll} / ${result.hit.chance}% — <strong>${result.hit.hit ? "Hit" : "Miss"}</strong></p><p>Damage: <strong>${damage}</strong></p>${comparisonText}<p>${applied ? `HP: ${oldHP} → ${newHP}` : "Preview only — target HP unchanged"}</p><small>Armor/Resist and Rough remain provisional. Critical chances, powers, and Epic Talent chains are not automated.</small></div>`;
      await ChatMessage.create({user:game.user.id, speaker:ChatMessage.getSpeaker({actor:this.actor}), content});
      } catch (err) { console.error("Pirate101 attack failed",err); ui.notifications.error(`Attack failed: ${err.message}`); }
      finally { this._attackBusy = false; }
    });
    html.find("[data-equip]").on("change", async ev => {
      const item = this.actor.items.get(ev.currentTarget.dataset.equip);
      if (!item) return;
      const slot = item.system.slot;
      if (ev.currentTarget.checked && slot !== "none" && slot !== "other") {
        const previous = this.actor.items.filter(i => i.id !== item.id && i.system.equipped && i.system.slot === slot);
        if (previous.length) await this.actor.updateEmbeddedDocuments("Item",previous.map(i=>({_id:i.id,"system.equipped":false})));
      }
      await item.update({"system.equipped":ev.currentTarget.checked});
    });
    html.find("[data-slot]").on("change", async ev => {
      const item = this.actor.items.get(ev.currentTarget.dataset.slot);
      if (item) await item.update({"system.slot":ev.currentTarget.value});
    });
    html.find("[data-delete]").on("click", async ev => {
      const item = this.actor.items.get(ev.currentTarget.dataset.delete);
      if (item && await Dialog.confirm({title:"Delete item?",content:`Delete ${foundry.utils.escapeHTML(item.name)}?`})) await item.delete();
    });
  }
}
Hooks.once("init", () => {
  Actors.registerSheet("pirate101-flex", Pirate101ActorSheet, {types:["pirate","companion","enemy","boss","summon"],makeDefault:true,label:"Pirate101 Character Sheet"});
});

// Phase 3: editable item configuration, including additive stat modifiers.
class Pirate101ItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes:["pirate101-flex","sheet","item"], template:"systems/pirate101-flex/templates/item-sheet.hbs",
      width:540,height:600,resizable:true,submitOnChange:true,closeOnSubmit:false
    });
  }
  getData(options={}) {
    const data=super.getData(options), item=this.item;
    return {...data, system:item.system, isGear:["weapon","equipment"].includes(item.type),
      isWeapon:item.type==="weapon", isTalent:item.type==="talent", isPower:item.type==="power",
      slots:{none:"Unassigned",weapon:"Weapon",hat:"Hat",outfit:"Outfit",boots:"Boots",amulet:"Amulet",ring:"Ring",totem:"Totem",pet:"Pet",other:"Other"},
      attributes:{strength:"Strength",agility:"Agility",will:"Will"},
      modifiers:item.system.modifiers.map((m,index)=>({...m,index}))};
  }
  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-add-modifier]").on("click",async()=>{
      const modifiers=this.item.system.modifiers.map(m=>m.toObject ? m.toObject():foundry.utils.deepClone(m));
      modifiers.push({stat:"strength",value:0,enabled:true,condition:""});
      await this.item.update({"system.modifiers":modifiers});
    });
    html.find("[data-remove-modifier]").on("click",async ev=>{
      const index=Number(ev.currentTarget.dataset.removeModifier);
      const modifiers=this.item.system.modifiers.map(m=>m.toObject ? m.toObject():foundry.utils.deepClone(m));
      modifiers.splice(index,1);
      await this.item.update({"system.modifiers":modifiers});
    });
  }
}
Hooks.once("init",()=>{
  Items.registerSheet("pirate101-flex",Pirate101ItemSheet,{types:["weapon","equipment","talent","power","effect"],makeDefault:true,label:"Pirate101 Item Sheet"});
});
