import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAbilityLevels, applyAbilityLevels } from '../lib/ability-levels.js';
const domains=counts=>['pattern','logic','spatial'].map((domain,i)=>({domain,count:10,correct:counts[i],excluded:0}));
test('all correct-count boundaries match internal bands',()=>{
 const levels=['needs_development','needs_development','needs_development','needs_development','needs_development','typical','typical','strong','strong','very_strong','very_strong'];
 for(let correct=0;correct<=10;correct++) assert.equal(buildAbilityLevels(domains([correct,correct,correct]))[0].level,levels[correct]);
 const example=buildAbilityLevels(domains([7,3,9]));
 assert.deepEqual(example.map(x=>x.level),['strong','needs_development','very_strong']);
 assert.ok(example[0].assessment.includes('패턴인지능력이 뛰어납니다'));
 assert.ok(example[1].assessment.includes('논리추론능력은 보완이 필요합니다'));
 assert.ok(example[2].assessment.includes('공간지각능력이 매우 뛰어납니다'));
});
test('server overrides contradictory model assessments and preserves matching evidence',()=>{
 const ability_levels=buildAbilityLevels(domains([7,3,9]));
 const report={cognitive_characteristics:[{title:'공간지각능력',assessment:'Needs development',evidence:'입체 모양을 잘 판단했습니다.'}]};
 const result=applyAbilityLevels(report,{ability_levels,language:'ko'});
 assert.equal(result.cognitive_characteristics.length,3);
 assert.equal(result.cognitive_characteristics[2].assessment,ability_levels[2].assessment);
 assert.equal(result.cognitive_characteristics[2].evidence,'입체 모양을 잘 판단했습니다.');
 assert.equal(report.cognitive_characteristics[0].assessment,'Needs development');
});
test('no valid responses are unclassified and English assessment uses internal bands',()=>{
 const rows=domains([0,6,9]);rows[0].excluded=10;
 assert.equal(buildAbilityLevels(rows)[0].level,'insufficient');
 assert.ok(buildAbilityLevels(rows,'en')[1].assessment.includes('typical band'));
});
