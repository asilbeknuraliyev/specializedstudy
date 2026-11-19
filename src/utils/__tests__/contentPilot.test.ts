import test from 'node:test';
import assert from 'node:assert/strict';
import {pilot} from '../../../scripts/contentPilot';
import {additionalPilot} from '../../../scripts/contentPilotExercises';
import {bankQuestion} from '../../server/topicEngine';

test('editorial pilot aligns with three distinct source topics and rejects a changed key', () => {
  assert.equal(new Set(pilot.map(row=>row.topic)).size,3);
  for (const row of pilot) {
    assert.match(row.topic,/^[0-9a-f]{64}$/);
    assert(row.verify(row.key));
    assert(!row.verify(String(Number(row.key)+1)));
    assert(bankQuestion.safeParse({...row,kind:'short',points:1}).success);
  }
});

test('27 additional pilot questions have deterministic keys, explanation steps and distinct prompts', () => {
  assert.equal(pilot.length + additionalPilot.length, 30);
  const prompts = [...pilot, ...additionalPilot].map(row => row.prompt.normalize('NFKC').toLowerCase());
  assert.equal(new Set(prompts).size, 30);
  for (const row of additionalPilot) {
    assert(row.verify(row.key), row.prompt);
    assert(!row.verify(row.key + 'x'));
    assert(row.steps.every(step => step.trim().length > 0));
    assert(row.hint.trim().length > 0);
    assert(bankQuestion.safeParse({...row, points:1}).success, row.prompt);
  }
});
