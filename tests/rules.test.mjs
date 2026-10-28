import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveStats, hitChance, primaryDamageBonus, weaponDamageRange, resolveBasicAttack, applyDefense} from '../system/rules.mjs';
test('published base accuracy expression', () => assert.equal(hitChance({accuracy:15},{dodge:20}).chance,70));
test('hit chance clamps', () => {assert.equal(hitChance({accuracy:200},{dodge:0}).chance,100);assert.equal(hitChance({accuracy:0},{dodge:200}).chance,0);});
test('primary scaling example', () => {assert.equal(primaryDamageBonus(75),15);assert.deepEqual([weaponDamageRange({strength:75,rough:0},{attribute:'strength',damage:{min:40,max:60}}).min,weaponDamageRange({strength:75,rough:0},{attribute:'strength',damage:{min:40,max:60}}).max],[55,75]);});
test('equipment and effects accumulate', () => {const result=deriveStats({base:{strength:20,maxHealth:100},health:{value:120}},[{equipped:true,modifiers:[{stat:'strength',value:5}]}],[{modifiers:[{stat:'strength',value:-3}]}]);assert.equal(result.stats.strength,22);assert.equal(result.health.value,100);});
test('defense modes are configurable', () => {assert.equal(applyDefense(50,{armor:10}),40);assert.equal(applyDefense(50,{armor:10},'physical',{armorMode:'percent'}),45);});
test('misses deal zero', () => {const r=resolveBasicAttack({attacker:{accuracy:0},defender:{dodge:100},weapon:{attribute:'strength',damage:{min:5,max:10}},rng:()=>0.5});assert.equal(r.damage,0);});
