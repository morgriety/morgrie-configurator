import {describe, expect, mock, test} from 'bun:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {VIAKey} from '@the-via/reader';
import {getKeyboardFocusTarget, getNavigableKeyName} from '../src/components/two-string/key-navigation';

const key = (x: number, y: number, w = 1) => ({x, y, w, h: 1} as VIAKey);
const top = [key(0, 0), key(1, 0), key(2, 0)];
const bottom = [key(0, 1, 2), key(2, 1)];
const rows = [top, bottom];
describe('2D configuration keyboard navigation', () => {
  test('visits each physical key across uneven rows in both directions', () => {
    const order = rows.flat();
    order.forEach((k, i) => {
      expect(getKeyboardFocusTarget(k, rows, 'ArrowRight')).toBe(order[i + 1] ?? k);
      expect(getKeyboardFocusTarget(k, rows, 'ArrowLeft')).toBe(order[i - 1] ?? k);
    });
  });
  test('up and down follow the nearest physical key in the adjacent row', () => {
    expect(getKeyboardFocusTarget(top[1], rows, 'ArrowDown')).toBe(bottom[0]);
    expect(getKeyboardFocusTarget(bottom[1], rows, 'ArrowUp')).toBe(top[2]);
    expect(getKeyboardFocusTarget(bottom[1], rows, 'ArrowDown')).toBe(bottom[1]);
  });
  test('row ends, Tab and keys removed by a physical layout change', () => {
    expect(getKeyboardFocusTarget(top[1], rows, 'Home')).toBe(top[0]);
    expect(getKeyboardFocusTarget(top[1], rows, 'End')).toBe(top[2]);
    expect(getKeyboardFocusTarget(top[1], rows, 'Tab')).toBeUndefined();
    expect(getKeyboardFocusTarget(key(0, 1), rows, 'ArrowDown')).toBeUndefined();
  });
});

test('collapsed host layout picker exposes only its named disclosure button', async () => {
  mock.module('../src/store/hooks', () => ({
    useAppDispatch: () => () => {},
    useAppSelector: (select: () => string) => select(),
  }));
  mock.module('../src/store/settingsSlice', () => ({
    getHostKeyboardLayout: () => 'keymap_us',
    updateHostKeyboardLayout: (key: string) => key,
  }));
  mock.module('react-i18next', () => ({
    useTranslation: () => ({t: (key: string) => key}),
  }));
  const {HostKeyboardLayoutBadge} = await import(
    '../src/components/panes/configure-panes/host-keyboard-layout-badge'
  );
  const html = renderToStaticMarkup(createElement(HostKeyboardLayoutBadge));
  expect(html.match(/<button\b/g)).toHaveLength(1);
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain('aria-label="Host Keyboard Layout:');
  expect(html).not.toContain('<ul');
});

test('accessible names announce the macro slot without exposing saved content', () => {
  const macros = {_QK_MACRO: 200, _QK_MACRO_MAX: 215};
  expect(getNavigableKeyName({label: 'M3', tooltipLabel: 'private text'}, 203, macros, {})).toBe('MACRO(3)');
  expect(getNavigableKeyName({label: 'RShift', tooltipLabel: 'Right Shift'}, 42, macros, {})).toBe('Right Shift');
  expect(getNavigableKeyName({topLabel: '!', bottomLabel: '1'}, 30, macros, {})).toBe('! 1');
});
