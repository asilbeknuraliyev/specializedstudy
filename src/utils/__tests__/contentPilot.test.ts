import test from 'node:test';
import assert from 'node:assert/strict';
import {pilot} from '../../../scripts/contentPilot';
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
