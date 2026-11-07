import {advancedStringToKeycode} from './advanced-keys';
import {getByteForCode} from './key';
import deprecatedKeycodes from './key-to-byte/deprecated-keycodes';
import {getMacroAPI, getMacroValidator} from './macro-api';
import {
  expressionToSequence,
  optimizedSequenceToRawSequence,
} from './macro-api/macro-api.common';
import {RawKeycodeSequenceAction} from './macro-api/types';

type BackupValidationInput = {
  layers: unknown;
  encoders?: unknown;
  macros?: unknown;
  basicKeyToByte: Record<string, number>;
  protocol: number;
  keycodesVersion?: number;
  macroCount: number;
  macroBufferSize: number;
  macrosSupported: boolean;
};

const owns = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);
const simpleRanges: Record<string, string> = {
  TO: '_QK_TO', MO: '_QK_MOMENTARY', DF: '_QK_DEF_LAYER',
  TG: '_QK_TOGGLE_LAYER', OSL: '_QK_ONE_SHOT_LAYER',
  TT: '_QK_LAYER_TAP_TOGGLE', CUSTOM: '_QK_KB', MACRO: '_QK_MACRO',
};
const unsignedWithin = (value: string, max: number) =>
  /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) &&
  Number(value) >= 0 && Number(value) <= max;

// The shared advanced parser uses zero for failure and is permissive about
// missing parentheses/numeric suffixes. Validate its input before using it;
// never change the application's parser or silently clamp imported values.
function validAdvanced(code: string, dictionary: Record<string, number>): boolean {
  const match = /^([A-Z]+)\((.*)\)$/.exec(code);
  if (!match) return false;
  const [, name, args] = match;
  const basic = (key: string) => owns(dictionary, key) &&
    Number.isInteger(dictionary[key]) && dictionary[key] >= 0 && dictionary[key] <= 255;
  const mods = (value: string) => /^[A-Z_ |]+$/.test(value) &&
    advancedStringToKeycode('OSM(' + value + ')', dictionary) > 0;

  if (owns(simpleRanges, name)) {
    const base = simpleRanges[name];
    return unsignedWithin(args.trim(), dictionary[base + '_MAX'] - dictionary[base]);
  }
  const parts = args.split(',').map(part => part.trim());
  if (name === 'LT') return parts.length === 2 && unsignedWithin(parts[0], 15) && basic(parts[1]);
  if (name === 'MT') return parts.length === 2 && mods(parts[0]) && basic(parts[1]);
  if (name === 'LM') return parts.length === 2 && unsignedWithin(parts[0], 15) && mods(parts[1]);
  if (name === 'OSM') return parts.length === 1 && mods(parts[0]);

  // Modifier aliases and nested modifier chains are recognized by VIA itself.
  if (advancedStringToKeycode(name + '(KC_NO)', dictionary) <= 0) return false;
  const inner = args.trim();
  return basic(inner) || (
    !/^(?:TO|MO|DF|TG|OSL|TT|CUSTOM|MACRO|LT|MT|LM|OSM)\(/.test(inner) &&
    validAdvanced(inner, dictionary)
  );
}

function parseBackupKeycode(value: unknown, dictionary: Record<string, number>): number {
  if (typeof value !== 'string') throw new Error('Backup keycodes must be strings.');
  const code = owns(deprecatedKeycodes, value) ? deprecatedKeycodes[value] : value;
  let byte: number;
  if (owns(dictionary, code)) {
    byte = dictionary[code]; // Includes the legitimate KC_NO = 0.
  } else if (/^0x[0-9a-f]{1,4}$/i.test(code)) {
    byte = Number.parseInt(code.slice(2), 16); // getCodeForByte exports raw unknown codes.
  } else {
    if (!validAdvanced(code.toUpperCase(), dictionary) ||
        advancedStringToKeycode(code, dictionary) === 0) {
      throw new Error('Unknown or invalid backup keycode: ' + value);
    }
    byte = getByteForCode(code, dictionary);
  }
  if (!Number.isInteger(byte) || byte < 0 || byte > 0xffff) {
    throw new Error('Backup keycode is outside the 16-bit range: ' + value);
  }
  return byte;
}

/** Pure preflight: call once before any import write and use the returned codes.
 * Target identity and exact matrix/encoder dimensions are checked by the caller.
 * No KeyboardAPI is constructed and no device methods are invoked here.
 */
export function validateBackupKeycodesAndMacros(input: BackupValidationInput): {
  layers: number[][];
  encoders?: [number, number][][];
} {
  const {basicKeyToByte: dictionary} = input;
  if (!Array.isArray(input.layers) || input.layers.some(layer => !Array.isArray(layer))) {
    throw new Error('Invalid backup keymap layers.');
  }
  const layers = input.layers.map(layer =>
    layer.map((key: unknown) => parseBackupKeycode(key, dictionary)));
  let encoders: [number, number][][] | undefined;
  if (input.encoders !== undefined) {
    if (!Array.isArray(input.encoders) || input.encoders.some(encoder =>
      !Array.isArray(encoder) || encoder.some(pair => !Array.isArray(pair) || pair.length !== 2))) {
      throw new Error('Invalid backup encoder data.');
    }
    encoders = input.encoders.map(encoder => encoder.map((pair: unknown[]) => [
      parseBackupKeycode(pair[0], dictionary), parseBackupKeycode(pair[1], dictionary),
    ] as [number, number]));
  }

  if (input.macros !== undefined) {
    if (!input.macrosSupported) throw new Error('This keyboard does not support macro import.');
    if (!Array.isArray(input.macros) || input.macros.some(macro => typeof macro !== 'string')) {
      throw new Error('Invalid backup macros.');
    }
    if (!Number.isInteger(input.macroCount) || input.macroCount < 0 ||
        input.macros.length !== input.macroCount) {
      throw new Error('Backup macro count does not match this keyboard.');
    }
    if (!Number.isInteger(input.macroBufferSize) || input.macroBufferSize <= 0) {
      throw new Error('Macro buffer capacity is unavailable.');
    }
    const validate = getMacroValidator(input.protocol);
    const sequences = input.macros.map((expression: string) => {
      const result = validate(expression);
      if (!result.isValid) throw new Error(result.errorMessage ?? 'Invalid backup macro.');
      const sequence = optimizedSequenceToRawSequence(expressionToSequence(expression));
      // Literal terminators/action prefixes cannot be persisted as ordinary text.
      if (sequence.some(([action, text]) => action === RawKeycodeSequenceAction.CharacterStream &&
          [...String(text)].some(char => char.charCodeAt(0) === 0 ||
            char.charCodeAt(0) <= (input.protocol >= 11 ? 1 : 3)))) {
        throw new Error('Macro text contains reserved control bytes.');
      }
      return sequence;
    });
    // Only the pure encoder is used. Its read/write methods require a device API
    // and are deliberately unavailable to this preflight function.
    const codec = getMacroAPI(input.protocol, input.keycodesVersion, undefined!);
    const bytes = codec.rawKeycodeSequencesToMacroBytes(sequences);
    if (bytes.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
      throw new Error('Macro contains a keycode or character unsupported by this protocol.');
    }
    if (bytes.length > input.macroBufferSize) {
      throw new Error('Macro size (' + bytes.length + ') exceeds buffer size (' + input.macroBufferSize + ').');
    }
  }
  return {layers, encoders};
}
