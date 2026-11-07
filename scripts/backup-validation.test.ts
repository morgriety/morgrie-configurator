/**
 * Pure backup preflight tests: no browser, HID, storage or firmware I/O.
 * Run independently with: bun test scripts/backup-validation.test.ts
 */
import {describe, expect, test} from 'bun:test';
import {getBasicKeyDict} from '../src/utils/key-to-byte/dictionary-store';
import {getByteForCode} from '../src/utils/key';
import {getMacroAPI} from '../src/utils/macro-api';
import {expressionToSequence, optimizedSequenceToRawSequence} from '../src/utils/macro-api/macro-api.common';
import {runBoundImport} from '../src/utils/backup-target';
import {validateBackupKeycodesAndMacros} from '../src/utils/backup-validation';

const basicKeyToByte = getBasicKeyDict(13, 0);
const options = {
  layers: [['KC_A', 'KC_NO']],
  basicKeyToByte,
  protocol: 13,
  keycodesVersion: 0,
  macroCount: 2,
  macroBufferSize: 64,
  macrosSupported: true,
};
const check = (changes: Partial<Parameters<typeof validateBackupKeycodesAndMacros>[0]> = {}) =>
  validateBackupKeycodesAndMacros({...options, ...changes});

describe('backup keycode preflight', () => {
  test('retains zero keycode, deprecated aliases and valid raw exports', () => {
    expect(check({layers: [['KC_NO', 'KC_A', 'KC_EXLM', '0x1234', '0xffff']]}).layers)
      .toEqual([[0, 4, getByteForCode('S(KC_1)',basicKeyToByte), 0x1234, 0xffff]]);
  });

  test.each([10, 11, 12, 13])('preserves supported advanced expressions for protocol %i', protocol => {
    const dict = getBasicKeyDict(protocol, protocol >= 13 ? 0 : undefined);
    const codes = ['TO(1)', 'MO(2)', 'DF(0)', 'TG(1)', 'OSL(2)', 'TT(1)',
      'OSM(MOD_LCTL)', 'LT(1,KC_A)', 'MT(MOD_LSFT | MOD_LCTL,KC_B)',
      'LM(1,MOD_LSFT)', 'LCTL(KC_A)', 'LCTL(LSFT(KC_B))', 'CUSTOM(1)', 'MACRO(0)'];
    expect(check({layers:[codes], basicKeyToByte:dict, protocol,
      keycodesVersion: protocol >= 13 ? 0 : undefined}).layers)
      .toEqual([codes.map(code => getByteForCode(code, dict))]);
  });

  test.each(['NOT_A_KEY', '', '[object Object]', 'toString', '0x10000',
    'MO(bad)', 'MO(-1)', 'MO(999999)', 'LT(1foo,KC_A)', 'LT(16,KC_A)',
    'MT(MOD_UNKNOWN,KC_A)', 'LCTL(NOT_A_KEY)', 'LCTL(KC_A',
    'LCTL(KC_A))', 'KC_A(KC_B)', 'MO(1)junk', 'MACRO(99999)'])
    ('rejects unknown or malformed keycode %j', key => {
      expect(() => check({layers:[[key]]})).toThrow();
    });

  test.each([null, 0, false, {}, ['KC_A']].map(value=>[value]))('rejects non-string keycode %j', key => {
    expect(() => check({layers:[[key]]})).toThrow();
  });

  test('validates encoder keycodes and returns exact encoded directions', () => {
    expect(check({encoders: [[['KC_NO','LCTL(KC_A)'],['0x1234','KC_B']]]}).encoders)
      .toEqual([[[0, getByteForCode('LCTL(KC_A)', basicKeyToByte)], [0x1234,5]]]);
    expect(() => check({encoders: [[['KC_A','NOT_A_KEY']]]})).toThrow();
  });

  test.each([null, 0, {}, ['KC_A'], [[null]]].map(value=>[value]))('rejects malformed layers %j', layers => {
    expect(() => check({layers})).toThrow();
  });
});

describe('backup macro preflight', () => {
  test('allows omitted macro fields on legacy backups', () => {
    expect(() => check({macrosSupported:false, macroCount:0, macroBufferSize:0})).not.toThrow();
  });

  test('preserves valid expressions and counts terminators in actual encoding', () => {
    const macros = ['hello{KC_A}', '{+KC_LCTL}{KC_C}{-KC_LCTL}{120}'];
    const bytes = getMacroAPI(13,0,undefined!).rawKeycodeSequencesToMacroBytes(
      macros.map(expression => optimizedSequenceToRawSequence(expressionToSequence(expression))));
    expect(() => check({macros,macroBufferSize:bytes.length})).not.toThrow();
    expect(() => check({macros,macroBufferSize:bytes.length-1})).toThrow('buffer');
  });

  test.each(['{KC_DOES_NOT_EXIST}', '{}', '{99999}', '{KC_A', '中', '\u0000'])
    ('rejects invalid macro %j', expression => {
      expect(() => check({macros:[expression,'']})).toThrow();
    });

  test('uses protocol-specific validation rather than accepting unsupported delay syntax', () => {
    expect(() => check({protocol:10,basicKeyToByte:getBasicKeyDict(10),
      keycodesVersion:undefined,macros:['{120}','']})).toThrow();
  });

  test.each([null, 1, {}, ['',null]].map(value=>[value]))('rejects malformed macro field %j', macros => {
    expect(() => check({macros})).toThrow();
  });

  test('rejects macro count mismatches and unsupported target macros', () => {
    expect(() => check({macros:['']})).toThrow('count');
    expect(() => check({macros:['',''], macrosSupported:false})).toThrow('support');
  });

  test.each([NaN, -1, 0, 1.5])('rejects unusable macro buffer metadata %j', macroBufferSize => {
    expect(() => check({macros:['',''],macroBufferSize})).toThrow();
  });
});

test.each([
  {layers:[['KC_A','NOT_A_KEY']]},
  {encoders:[[['KC_A','NOT_A_KEY']]]},
  {macros:['{KC_DOES_NOT_EXIST}','']},
  {macros:['hello',''],macroBufferSize:2},
])('complete data validation precedes every import write: %j', async changes => {
  const writes:string[]=[];
  await expect(runBoundImport({assertCurrent:()=>{}}, async()=>({...options,...changes}),
    data=>{validateBackupKeycodesAndMacros(data);},
    [async()=>{writes.push('macros');},async()=>{writes.push('keymap');},async()=>{writes.push('encoders');}]))
    .rejects.toThrow();
  expect(writes).toEqual([]);
});
