import {expect, test} from 'bun:test';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {getBuildTimestamp, normalizeDefinitionTimestamp} from './build-definitions.js';

test('source time uses seconds while the VIA index retains milliseconds', () => {
  expect(getBuildTimestamp('1794036101')).toBe(1794036101000);
  expect(getBuildTimestamp('0')).toBe(0);
});

test.each(['', '-1', '1.5', 'invalid', 'Infinity', '8640000000001'])(
  'rejects invalid source time %s instead of using the current clock', (value) => {
    expect(() => getBuildTimestamp(value)).toThrow('SOURCE_DATE_EPOCH');
  },
);

test('normalization removes wall-clock drift without changing the definition index data', () => {
  const directory = mkdtempSync(join(tmpdir(), 'morgrie-build-time-'));
  const file = join(directory, 'supported_kbs.json');
  const data = {version: '2.0.0', theme: {}, vendorProductIds: {v2: [1], v3: [2]}};
  try {
    writeFileSync(file, JSON.stringify({generatedAt: 1000, ...data}));
    normalizeDefinitionTimestamp(directory, getBuildTimestamp('1794036101'));
    const first = readFileSync(file, 'utf8');
    writeFileSync(file, JSON.stringify({generatedAt: 9999, ...data}));
    normalizeDefinitionTimestamp(directory, getBuildTimestamp('1794036101'));
    expect(readFileSync(file, 'utf8')).toBe(first);
    expect(JSON.parse(first)).toEqual({generatedAt: 1794036101000, ...data});
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});
