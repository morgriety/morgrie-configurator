import {beforeEach, expect, mock, test} from 'bun:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const air = {path: 'mock-air', modelDefinitionId: 'morgrie-air68', protocol: 12};
let device: typeof air | null;
let firmware: number | undefined;

// Real Settings, diagnostic rows, native switches and react-select markup.
// Only application state/side effects are replaced. No DOM events, USB or user storage.
mock.module('../src/store/hooks', () => ({useAppSelector: (select: () => unknown) => select()}));
mock.module('react-redux', () => ({useDispatch: () => () => {}}));
mock.module('react-i18next', () => ({useTranslation: () => ({t: (key: string) => key})}));
mock.module('../src/store/devicesSlice', () => ({getSelectedConnectedDevice: () => device}));
mock.module('../src/store/firmwareSlice', () => ({getSelectedFirmwareVersion: () => firmware}));
mock.module('../src/store/definitionsSlice', () => ({getSelectedBuiltinDefinition: () => undefined}));
mock.module('../src/components/panes/configure-panes/custom/menu-generator', () => ({MenuContainer: 'div'}));
mock.module('../src/components/inputs/message-dialog', () => ({MessageDialog: () => null}));
mock.module('../src/utils/test-webgl', () => ({webGLIsAvailable: true}));
mock.module('../src/store/settingsSlice', () => ({
  ...Object.fromEntries([
    'getShowDesignTab', 'getShowConsoleTab', 'getShowDesignTabConfirmationNotice',
    'getDisableFastRemap', 'toggleCreatorMode', 'toggleConsoleTab', 'toggleFastRemap',
    'updateShowSliderValuesMode', 'toggleThemeMode', 'updateThemeName', 'updateRenderMode',
    'setShowDesignTabConfirmationNotice',
  ].map(key => [key, () => false])),
  getShowSliderValuesMode: () => 'Slider Only', getThemeMode: () => 'light',
  getThemeName: () => 'MORGRIE_LIGHT', getRenderMode: () => '2D',
}));

const {Settings, DiagnosticInformation} = await import('../src/components/panes/settings');
const render = (component: () => any) => renderToStaticMarkup(createElement(component));
beforeEach(() => {device = air; firmware = undefined;});

test.each([true, false])('Settings labels identify each native control, connected=%s', async connected => {
  if (!connected) device = null;
  const labels = new Map<string, string>();
  const controls = new Map<string, string>();
  await new HTMLRewriter()
    .on('label[for]', {
      element(e) { labels.set(e.getAttribute('for')!, ''); },
      text(t) {
        const id = [...labels.keys()].at(-1)!;
        labels.set(id, labels.get(id)! + t.text);
      },
    })
    .on('input', {element(e) {
      const id = e.getAttribute('id');
      if (id) controls.set(id, e.getAttribute('role') || e.getAttribute('type')!);
    }})
    .transform(new Response(render(Settings))).text();
  const expected = [
    ['Show Design tab', 'checkbox'], ['Show HID Console tab', 'checkbox'],
    ['Fast Key Mapping', 'checkbox'], ['Light Mode', 'checkbox'],
    ['Keycap Theme', 'combobox'], ['Slider Mode', 'combobox'], ['Render Mode', 'combobox'],
  ];
  if (connected) expected.push(['Show Diagnostic Information', 'checkbox']);
  expect([...labels].map(([id, name]) => [name, controls.get(id)]).sort()).toEqual(expected.sort());
  expect(controls.size).toBe(expected.length);
});

test.each([undefined, 0, 0x90002345])('diagnostics separates all four fields for firmware %s', value => {
  firmware = value;
  const plain = render(DiagnosticInformation).replace(/<[^>]+>/g, '');
  const firmwareText = value ? '0x90002345' : 'Not available';
  expect(plain).toContain('Device Modelmorgrie-air68');
  expect(plain).toContain('Firmware Version' + firmwareText);
  expect(plain).toContain('JSON Definition VersionNot available');
  expect(plain).toContain('VIA Protocol Version12');
});

test('diagnostics follows the current instance and disappears when disconnected', () => {
  device = {path: 'mock-dos', modelDefinitionId: 'morgrie-dos68', protocol: 11};
  const markup = render(DiagnosticInformation);
  expect(markup).toContain('morgrie-dos68');
  expect(markup).not.toContain('morgrie-air68');
  device = null;
  expect(render(DiagnosticInformation)).toBe('');
});
