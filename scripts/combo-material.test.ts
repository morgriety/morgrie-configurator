import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ComboKeycap} from '../src/components/two-string/unit-key/combo-keycap';
import {MorgrieScaleContext} from '../src/components/two-string/morgrie-legend';
import type {VIADefinitionV3} from '@the-via/reader';
import {getComboMaterial} from '../src/components/two-string/unit-key/combo-material';
import {getComboKeyProps} from '../src/utils/keyboard-rendering';

type Point = [number, number];

// These samples are well clear of the 5px rounded corners. The quadratic
// control points give the corresponding sharp-corner outline for these probes.
function contains(corners: Point[], x: number, y: number) {
  let inside = false;
  for (let i = 0; i < corners.length; i++) {
    const [ax, ay] = corners[i];
    const [bx, by] = corners[(i + 1) % corners.length];
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) {
      inside = !inside;
    }
  }
  return inside;
}

for (const file of ['models/morgrie-dos68-v3.json', 'v3/4294836401.json']) {
  test(`${file} paints both arms of ISO Enter and leaves the adjacent key's notch clear`, () => {
    const json = readFileSync(resolve(import.meta.dir, '../public/definitions', file), 'utf8');
    const definition = JSON.parse(json) as VIADefinitionV3;
    const key = definition.layouts.optionKeys[0][1].find(k => k.w2 !== undefined)!;
    expect([key.row, key.col]).toEqual([2, 13]);
    const {clipPath, normalizedRects} = getComboKeyProps(key);
    const material = getComboMaterial(normalizedRects!)!;
    const hit = [...clipPath!.matchAll(/([-\d.]+)% ([-\d.]+)%/g)].map(
      ([, x, y]): Point => [Number(x) * material.width / 100, Number(y) * material.height / 100],
    );

    for (const clip of [material.wallClip, material.faceClip]) {
      expect(clip.match(/M /g)).toHaveLength(1);
      expect(clip.match(/ Z/g)).toHaveLength(1);
      const paint: Point[] = [...clip.matchAll(/Q ([-\d.]+) ([-\d.]+) /g)].map(
        ([, x, y]) => [Number(x), Number(y)],
      );
      // Wing, stem, rectangle overlap, adjacent key, surrounding frame.
      for (const [x, y, wanted] of [[10, 24, true], [46, 83, true], [46, 24, true],
        [7, 83, false], [-4, 24, false]] as const) {
        expect(contains(hit, x, y)).toBe(wanted);
        expect(contains(paint, x, y)).toBe(wanted);
      }
    }
    const label = material.legendBox;
    expect(contains(hit, label.left + label.width / 2, label.top + label.height / 2)).toBe(true);
  });
}

test('disconnected custom key rectangles retain the original VIA drawing path', () => {
  expect(getComboMaterial([[0, 0, 1, 1], [0, 1.5, 1, 1]])).toBeNull();
  expect(getComboMaterial([[0, 0, 1, 1], [1.5, 0, 1, 1]])).toBeNull();
});

test('the fallback paints every selected part, suppressing glow only in brand Configure', () => {
  const key = createElement(ComboKeycap, {
    normalizedRects: [[0, 0, 1, 1], [0, 1.5, 1, 1]],
    color: {c: '#123456'},
    selected: true,
    keycapZ: 0,
  });
  const brand = renderToStaticMarkup(createElement(
    MorgrieScaleContext.Provider, {value: {scale: 1, pixelRatio: 1}}, key,
  ));
  expect(brand).toContain('data-selected="true"');
  expect(brand).toContain('animation:initial');
  expect(brand).not.toContain('select-glow');
  expect(brand.match(/background:var\(--mg-keycap\)/g)).toHaveLength(3);
  expect(brand.match(/background:var\(--mg-keyboard-frame\)/g)).toHaveLength(3);

  const via = renderToStaticMarkup(key);
  expect(via).toContain('.75s infinite alternate select-glow');
  expect(via).not.toContain('var(--mg-keycap)');
  expect(via).toContain('background:#123456');
});
