import {normalizedText,standardSubject} from '../utils/schoolSourceImport';
const normalize=(s:string)=>normalizedText(s).toLowerCase().replace(/[ʻʼ‘’`']/g,'').replace(/[^\p{L}\p{N} ]/gu,'').trim();
/** Full source names and initials are compared exactly; fuzzy spellings remain review items. */
export function teacherReferenceCandidates<T extends {displayName:string}>(reference:string,people:T[]){
 const parts=normalizedText(reference).split(/\s+/),surname=normalize(parts[0]||''),initials=normalize(parts.slice(1).join('')).replace(/ /g,'');
 return people.filter(p=>{if(/vakant|вакан/i.test(p.displayName))return false;if(normalize(p.displayName)===normalize(reference))return true;const name=normalizedText(p.displayName).split(/\s+/);return normalize(name[0]||'')===surname&&name.slice(1,3).map(v=>normalize(v)[0]||'').join('')===initials;});
}
export function proposedTeachingSubject(source:string,declared:string[]){
 const value=standardSubject(source),subjects=declared.map(standardSubject);if(subjects.includes(value))return value;
 if(/^(?:algebra|geometriya)$/i.test(value)&&subjects.includes('Matematika'))return'Matematika';
 if(/^xorijiy til$/i.test(value)&&subjects.length===1&&subjects[0]==='Ingliz tili')return'Ingliz tili';return undefined;
}
