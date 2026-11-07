import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {getDefinitionRevisions} from './build-definitions.js';
import {getDefinitionRevision} from '../src/utils/definition-revision';

const root = 'public/definitions';
const revisions = getDefinitionRevisions(root);
const resource = (path: string) => JSON.parse(readFileSync(root + '/' + path, 'utf8'));
const vendorProductId = Number('0xFFFE') * 65536;
const spacetimeSource = JSON.parse(readFileSync(
  'definitions/v3/morgrie/spacetime65/rkb65_via_v1_01_20261020.json', 'utf8',
));

test.each([
  ['v3/4294836332.json', 'v1.02 (20250904)'],
  ['models/morgrie-dos68-v3.json', 'v1.02 (20261014)'],
  ['v3/' + (Number(spacetimeSource.vendorId) * 65536 + Number(spacetimeSource.productId)) + '.json', 'v1.01 (20261020)'],
])('matches loaded built-in resource %s to its exact source revision', async (path, version) => {
  expect(await getDefinitionRevision(resource(path), revisions)).toBe(version);
});

test('stale content carrying the same VID/PID, model name and schema cannot claim a current release', async () => {
  const stale = {...resource('v3/4294836332.json'), customKeycodes: []};
  expect(stale.vendorProductId).toBe(vendorProductId + 108);
  expect(await getDefinitionRevision(stale, revisions)).toBeUndefined();
});
