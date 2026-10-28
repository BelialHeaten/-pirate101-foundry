import {deriveStats, hitChance, weaponDamageRange, resolveBasicAttack, mergeRules} from "./rules.mjs";

const DEFAULT_ACTOR = {
  class: "buccaneer", level: 1, experience: 0,
  base: {strength: 0, agility: 0, will: 0, accuracy: 0, dodge: 0, armor: 0, resist: 0, rough: 0, spooky: 0, critical: 0, movement: 4, maxHealth: 100},
  health: {value: 100}, resources: {value: 0, max: 0},
  traits: [], tags: [], notes: ""
};
const DEFAULT_ITEM = {
  description: "", equipped: false, modifiers: [],
  attribute: "strength", damage: {min: 1, max: 2}, damageType: "physical", range: 1,
  trigger: "", rank: 1, uses: {value: 0, max: 0}, tags: []
};

Hooks.once("init", () => {
  console.info("Pirate101 Flexible Rules | Initializing Phase 1");
  game.settings.register("pirate101-flex", "rules", {
    name: "Rules configuration (advanced)", hint: "Configurable overrides for the Phase 1 calculation engine.",
    scope: "world", config: false, type: Object, default: mergeRules()
  });
  CONFIG.Actor.dataModels = Object.fromEntries(["pirate", "companion", "enemy", "boss", "summon"].map(t => [t, PirateActorData]));
  CONFIG.Item.dataModels = Object.fromEntries(["weapon", "equipment", "talent", "power", "effect"].map(t => [t, PirateItemData]));
  game.pirate101 = {deriveStats, hitChance, weaponDamageRange, resolveBasicAttack, mergeRules,
    get rules() {return game.settings.get("pirate101-flex", "rules");}};
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
      width: 700, height: 650, resizable: true, submitOnChange: true, closeOnSubmit: false
    });
  }
  getData(options = {}) {
    const data = super.getData(options);
    const system = this.actor.system;
    const derived = system.derived ?? deriveStats(system.toObject());
    const labels = {strength:"Strength", agility:"Agility", will:"Will", accuracy:"Accuracy", dodge:"Dodge", armor:"Armor", resist:"Resist", rough:"Rough", spooky:"Spooky", critical:"Critical", movement:"Movement", maxHealth:"Max Health"};
    return {...data, system, derived, classes: {buccaneer:"Buccaneer", musketeer:"Musketeer", privateer:"Privateer", swashbuckler:"Swashbuckler", witchdoctor:"Witchdoctor", custom:"Custom"},
      statRows: Object.entries(labels).map(([key,label]) => ({key,label,base:system.base[key],total:derived.stats[key]})),
      equipment: this.actor.items.filter(i => ["weapon","equipment"].includes(i.type)),
      powers: this.actor.items.filter(i => i.type === "power"), talents: this.actor.items.filter(i => i.type === "talent")};
  }
  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-tab]").on("click", ev => {
      const tab = ev.currentTarget.dataset.tab;
      html.find("[data-tab]").removeClass("active");
      html.find(`[data-tab="${tab}"]`).addClass("active");
      html.find("[data-panel]").prop("hidden", true);
      html.find(`[data-panel="${tab}"]`).prop("hidden", false);
    });
    html.find("[data-create]").on("click", async ev => {
      const type = ev.currentTarget.dataset.create;
      await this.actor.createEmbeddedDocuments("Item", [{name:`New ${type}`,type}]);
    });
    html.find("[data-open]").on("click", ev => this.actor.items.get(ev.currentTarget.dataset.open)?.sheet.render(true));
    html.find("[data-equip]").on("change", async ev => {
      await this.actor.items.get(ev.currentTarget.dataset.equip)?.update({"system.equipped":ev.currentTarget.checked});
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
