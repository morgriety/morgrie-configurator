import {expect, test} from 'bun:test';
import {getMorgrieLegend, paintMorgrieLegend} from '../src/components/two-string/morgrie-legend';

// Record Canvas calls with deterministic metrics. No browser or device state.
function surface() {
  const drawn: {text: string; x: number; y: number; font: string}[] = [];
  let transform: number[] = [];
  const ctx = {
    font: '',
    fillStyle: '',
    setTransform(...matrix: number[]) { transform = matrix; },
    measureText(text: string) {
      const size = Number(this.font.match(/([\d.]+)px/)![1]);
      const width = [...text].length * size * 0.55;
      return {width, actualBoundingBoxLeft: 0, actualBoundingBoxRight: width,
        actualBoundingBoxAscent: size * 0.75, actualBoundingBoxDescent: size * 0.15};
    },
    fillText(text: string, x: number, y: number, maxWidth?: number) {
      // Canvas compresses glyphs when maxWidth is supplied.
      expect(maxWidth).toBeUndefined();
      drawn.push({text, x, y, font: this.font});
    },
  };
  const canvas = {
    style: {}, width: 0, height: 0, getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
  return {canvas, ctx, drawn, getTransform: () => transform};
}

test.each([[0.7, 1], [1, 1], [1.13, 1.5], [1.2, 2]])(
  'one-letter legend uses 14 visible CSS px at board scale %s and DPR %s',
  (scale, pixelRatio) => {
    const {canvas, ctx, drawn, getTransform} = surface();
    expect(paintMorgrieLegend(canvas, 40, 42, {scale, pixelRatio}, {label: 'Q'})).toBe(false);
    expect(canvas.width).toBe(Math.round(40 * scale * pixelRatio));
    expect(canvas.height).toBe(Math.round(42 * scale * pixelRatio));
    expect(canvas.style.width).toBe('40px');
    expect(canvas.style.height).toBe('42px');
    expect(getTransform()).toEqual([canvas.width / (40 * scale), 0, 0, canvas.height / (42 * scale), 0, 0]);
    expect(ctx.fillStyle).toBe('#212121');
    expect(drawn[0]).toMatchObject({text: 'Q', font: '500 14px Inter, Arial, sans-serif'});
  },
);

test.each([0.65, 1.1])('shifted symbols and digits fit in separate rows at scale %s', (scale) => {
  const {canvas, ctx, drawn} = surface();
  expect(paintMorgrieLegend(canvas, 40, 42, {scale, pixelRatio: 2}, {topLabel: '!', bottomLabel: '1'})).toBe(false);
  const [upper, lower] = drawn;
  expect(drawn.map(row => row.text)).toEqual(['!', '1']);
  expect(upper.x).toBe(lower.x);
  if (scale === 1.1) {
    expect(upper.font).toBe('500 13px Inter, Arial, sans-serif');
    expect(lower.font).toBe(upper.font);
  }
  const {actualBoundingBoxDescent, actualBoundingBoxAscent} = ctx.measureText('1');
  expect(upper.y - actualBoundingBoxAscent).toBeGreaterThanOrEqual(0);
  expect(upper.y + actualBoundingBoxDescent).toBeLessThan(lower.y - actualBoundingBoxAscent);
  expect(lower.y + actualBoundingBoxDescent).toBeLessThanOrEqual(42 * scale);
});

test.each([
  ['Backspace', 88, 42], ['MO(1)', 40, 42], ['M0', 40, 42],
  ['↑', 40, 42], ['F12', 40, 42], ['Enter', 53.5, 98],
] as const)('draws the supplied %s label inside its actual face', (label, width, height) => {
  const {canvas, ctx, drawn} = surface();
  expect(paintMorgrieLegend(canvas, width, height, {scale: 1, pixelRatio: 2}, {label})).toBe(false);
  expect(drawn[0].text).toBe(label);
  expect(drawn[0].x + ctx.measureText(label).width).toBeLessThanOrEqual(width);
  expect(drawn[0].y).toBeLessThan(height);
  if (label === 'Enter') expect(drawn[0].y).toBeGreaterThan(42);
});

const namedFont = '500 11px Inter, Arial, sans-serif';
const unitScale = {scale: 1, pixelRatio: 1};

test.each([
  ['KC_CAPS', 'Caps Lock', 'Caps', 'Caps Lock'],
  ['KC_LSFT', 'LShft', 'LShift', 'Left Shift'],
  ['KC_RSFT', 'Right Shift', 'RShift', 'Right Shift'],
  ['KC_BSPC', 'Bksp', 'Backspace', 'Backspace'],
  ['KC_PGUP', 'PgUp', 'PgUp', 'Page Up'],
  ['KC_PGDN', 'PgDn', 'PgDn', 'Page Down'],
  ['KC_LCTL', 'LCtl', 'LCtrl', 'Left Ctrl'],
  ['KC_RCTL', 'RCtl', 'RCtrl', 'Right Ctrl'],
  ['KC_LALT', 'LAlt', 'LAlt', 'Left Alt'],
  ['KC_RALT', 'RAlt', 'RAlt', 'Right Alt'],
  ['KC_SPC', 'Space', 'Space', 'Space'],
  ['KC_ENT', 'Enter', 'Enter', 'Enter'],
  ['KC_TAB', 'Tab', 'Tab', 'Tab'],
  ['KC_DEL', 'Del', 'Del', 'Delete'],
  ['KC_INS', 'Ins', 'Ins', 'Insert'],
  ['MO(1)', 'MO(1)', 'MO(1)', 'MO(1)'],
])('%s paints a standard label and preserves VIA’s original data', (code, viaLabel, expected, fullName) => {
  const original = Object.freeze({label: viaLabel, tooltipLabel: code === 'KC_DEL' ? 'Del' : fullName});
  const legend = getMorgrieLegend(original, code);
  const {canvas, drawn} = surface();
  const tooltip = paintMorgrieLegend(canvas, 90, 42, unitScale, legend);
  expect(drawn).toHaveLength(1);
  expect(drawn[0]).toMatchObject({text: expected, font: namedFont});
  if (expected !== fullName) {
    expect(tooltip).toBe(true);
    expect(legend?.tooltipLabel).toBe(fullName);
  }
  expect(original.label).toBe(viaLabel);
});

test.each([
  ['KC_PGUP', 'Page Up', 'PgUp'],
  ['KC_PGDN', 'Page Down', 'PgDn'],
])('%s uses all available space on a narrow 1u face', (code, full, expected) => {
  const legend = getMorgrieLegend({label: full, tooltipLabel: full}, code);
  for (const pixelRatio of [1, 2]) {
    const {canvas, drawn, ctx} = surface();
    // Four glyphs measure 24.2 CSS px on a 26px face. Legacy margins left only 20.8px.
    expect(paintMorgrieLegend(canvas, 40, 42, {scale: 0.65, pixelRatio}, legend)).toBe(true);
    expect(drawn[0]).toMatchObject({text: expected, font: namedFont});
    expect(drawn[0].x).toBeGreaterThanOrEqual(0);
    expect(drawn[0].x + ctx.measureText(expected).width).toBeLessThanOrEqual(26);
  }
});

test('a narrow navigation legend stays within the original key and restores the unpadded bitmap on remap', () => {
  const {canvas, ctx, drawn} = surface();
  const scaled = {scale: 0.55, pixelRatio: 2};
  const legend = getMorgrieLegend({label: 'PgDn', tooltipLabel: 'Page Down'}, 'KC_PGDN');
  // The 22px face plus 2.2px of existing shoulder on each side can hold this 24.2px label.
  paintMorgrieLegend(canvas, 40, 42, scaled, legend, 4);
  const offset = parseFloat(canvas.style.marginLeft) * scaled.scale;
  expect(drawn[0]).toMatchObject({text: 'PgDn', font: namedFont});
  expect(drawn[0].x + offset).toBeGreaterThanOrEqual(-2.2);
  expect(drawn[0].x + offset + ctx.measureText('PgDn').width).toBeLessThanOrEqual(24.2);
  paintMorgrieLegend(canvas, 40, 42, scaled, {label: 'Q'}, 4);
  expect(canvas.style.marginLeft).toBe('');
  expect(canvas.style.width).toBe('40px');
  expect(canvas.width).toBe(44);
});

test('Backspace accommodates left and right ink overhang at its fixed size', () => {
  const {canvas, ctx, drawn} = surface();
  const measure = ctx.measureText.bind(ctx);
  ctx.measureText = (text: string) => text === 'Backspace'
    ? {...measure(text), width: 53, actualBoundingBoxLeft: 0.65, actualBoundingBoxRight: 53.54}
    : measure(text);
  const legend = getMorgrieLegend({label: 'Backspace', tooltipLabel: 'Backspace'}, 'KC_BSPC');
  const scale = 0.625;
  paintMorgrieLegend(canvas, 84.8, 42, {scale, pixelRatio: 2}, legend, 4);
  // The ink starts before the pen and extends 0.54 visible px past the advance.
  const {x} = drawn[0];
  const canvasWidth = parseFloat(canvas.style.width) * scale;
  expect(drawn[0]).toMatchObject({text: 'Backspace', font: namedFont});
  expect(x - 0.65).toBeGreaterThanOrEqual(0);
  expect(x + 53.54).toBeLessThanOrEqual(canvasWidth);
  // Advance alone would fit this 54px space. The complete ink requires 54.19px.
  expect(paintMorgrieLegend(canvas, 54, 42, unitScale, legend)).toBe(true);
  expect(drawn[1]).toMatchObject({text: 'Bksp', font: namedFont});
});

test('split Backspace uses Bksp at the same size as a full Backspace', () => {
  const legend = getMorgrieLegend({label: 'Bksp', tooltipLabel: 'Backspace'}, 'KC_BSPC', 'Bksp');
  for (const [width, expected] of [[40, 'Bksp'], [95, 'Backspace']] as const) {
    const {canvas, drawn} = surface();
    const tooltip = paintMorgrieLegend(canvas, width, 42, unitScale, legend);
    expect(drawn[0]).toMatchObject({text: expected, font: namedFont});
    if (width === 40) expect(tooltip).toBe(true);
  }
  expect(legend?.tooltipLabel).toBe('Backspace');
});

test.each(['CUSTOM(0)', 'MACRO(3)', undefined])('display text alone never maps %s to a standard key', (code) => {
  const original = {label: 'Caps Lock', tooltipLabel: 'Caps Lock', macroExpression: 'Left Shift'};
  const {canvas, drawn} = surface();
  const legend = getMorgrieLegend(original, code);
  paintMorgrieLegend(canvas, 95, 42, unitScale, legend);
  expect(drawn[0]).toMatchObject({text: 'Caps Lock', font: namedFont});
  expect(legend).toMatchObject({macroExpression: 'Left Shift'});
});

test('an existing VIA short name can be used when the original does not fit', () => {
  const legend = getMorgrieLegend({label: 'Print Screen', tooltipLabel: 'Print Screen'}, 'KC_PSCR', 'Print');
  const {canvas, drawn} = surface();
  expect(paintMorgrieLegend(canvas, 40, 42, unitScale, legend)).toBe(true);
  expect(drawn[0]).toMatchObject({text: 'Print', font: namedFont});
  expect(legend?.tooltipLabel).toBe('Print Screen');
});

test('an over-wide custom name retains its full tooltip and never gains an ellipsis', () => {
  const name = 'KeyboardCustomAction';
  const legend = getMorgrieLegend({label: name, tooltipLabel: name}, 'CUSTOM(1)');
  const {canvas, ctx, drawn} = surface();
  expect(paintMorgrieLegend(canvas, 40, 42, unitScale, legend)).toBe(true);
  expect(ctx.font).toBe(namedFont);
  expect(drawn.map(row => row.text)).toEqual([name]);
  expect(legend?.tooltipLabel).toBe(name);
});

test('a blank key resets the bitmap without painting a placeholder', () => {
  const {canvas, drawn} = surface();
  expect(paintMorgrieLegend(canvas, 40, 42, {scale: 1, pixelRatio: 1})).toBe(false);
  expect(canvas.width).toBe(40);
  expect(drawn).toHaveLength(0);
});
