import test from 'node:test';import assert from 'node:assert/strict';
import {schoolClassCode,parsePeople,parseSchoolPlan,inferSchoolPlanTarget} from '../schoolSourceImport';
test('school roster maps source A/B/E without inventing classes and preserves row provenance and incomplete staff',()=>{
 assert.equal(schoolClassCode('5-A'),'5a1');assert.equal(schoolClassCode('9-B'),'9a2');assert.equal(schoolClassCode('11-E'),'11t');assert.equal(schoolClassCode('6-E'),undefined);
 const parsed=parsePeople([{name:'Roster',startRow:4,rows:[['Классы школы','ФИО ученика'],['8-B','DEMO Learner One'],['8-B','DEMO Learner One']]}],'student');assert.equal(parsed.people.length,2);assert.equal(parsed.people[0].sourceRow,5);assert.equal(parsed.issues[0].code,'DUPLICATE_SOURCE');
 const staff=parsePeople([{name:'Staff',rows:[['Полное наименование','Должность','Предмет преподавания'],['DEMO','Maktab direktori','']]}],'teacher');assert.equal(staff.people.length,1);assert.ok(staff.issues.some(v=>v.code==='INVALID_NAME'));assert.equal(staff.people[0].role,'teacher');assert.equal(staff.people[0].subjects.length,0);
});
test('workplan parser handles Russian number sign, lesson ordinals and empty sheets while ambiguous targets require review',()=>{
 const sheet={name:'8 класс',rows:[['8 - класс (68 ч.)'],['№','Тема урока','Тип урока','Работа в классе','Домашнее задание','кол-во часов','примечания','Четверть'],['1-урок','DEMO topic','обычный','Practice','Read','1','','1']]};
 const parsed=parseSchoolPlan([sheet,{name:'Empty',rows:[]}]);assert.equal(parsed.lessons[0].order,1);assert.equal(parsed.lessons[0].sourceRow,3);assert.equal(parsed.lessons[0].quarter,1);assert.equal(parsed.issues.length,0);
 const target=inferSchoolPlanTarget('Plans/[Rus tili]/8-sinf.xlsx',sheet);assert.equal(target.grade,8);assert.equal(target.track,undefined);assert.equal(target.classCodes.length,0);assert.ok(target.issues.length);
 const conflict=inferSchoolPlanTarget('Plans/[Biologiya]/7-sinf_aniq.xlsx',{name:'8 kimyo tabiiy',rows:[['8-SINF BIOLOGIYA']]});assert.equal(conflict.grade,undefined);assert.ok(conflict.issues.length>=2);
});
