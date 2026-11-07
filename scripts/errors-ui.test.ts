import {beforeEach, expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import * as ts from 'typescript';
import * as React from 'react';
import {createInstance} from 'i18next';
import zh from '../src/locales/zh.json';
import {renderToStaticMarkup} from 'react-dom/server';
import makeMatcher from 'wouter/matcher';
import errorReducer, {clearAppErrors, getAppErrors, logAppError} from '../src/store/errorsSlice';

// Run in its own Bun process. Actual component functions and handlers execute
// against a deterministic hook/tree harness; presentation dependencies are
// inert. The real error reducer is in memory. No DOM, HID, storage or file I/O
// is available to component handlers; downloads use an in-memory writable.
// This is not a browser, React reconciliation or hardware acceptance test.
let translate = (key: string) => key;
let location = '/settings';
const matchRoute = makeMatcher();
const navigationCalls: string[] = [];
let state: any;
let hookSlots: Map<string, any[]>;
let activeSlots: any[];
let cursor = 0;
let download: {name?: string; blobs: Blob[]; closed: boolean};
let pickerError: Error | undefined;
const modules = new Map<string, any>();
const root = resolve(import.meta.dir, '..');
const jsx = require('react/jsx-runtime');
const react = {
  ...React,
  useState(initial: any) {
    const slots = activeSlots, index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], (next: any) => {slots[index] = typeof next === 'function' ? next(slots[index]) : next;}];
  },
  useMemo(fn: () => any) {return fn();},
};
const domProps = (props: any) => Object.fromEntries(Object.entries(props).filter(([key]) =>
  key === 'children' || key === 'disabled' || key === 'title' || key === 'href' ||
  key.startsWith('aria-') || key.startsWith('data-') || key.startsWith('on')));
const view = (name: string, tag = 'div') => (props: any) => React.createElement(tag, {'data-view': name, ...domProps(props)}, props.children);
const tag = (base: any) => (..._template: any[]) => (props: any) =>
  React.createElement(base, domProps(props), props.children);
const styled = new Proxy((base: any) => tag(base), {get: (_target, name) => tag(String(name))});
const SettingsContent = view('settings-content');
const SaveLoadContent = view('save-load-content');
const fields = ['Grid', 'MenuCell', 'Row', 'IconContainer', 'SpanOverflowCell', 'CategoryIconContainer'];
const emptyComponents = Object.fromEntries(fields.map(name => [name, view(name)]));
const selectors = {
  getSelectedConnectedDevice: (s: any) => s.device,
  getIsSelectedDeviceReady: (s: any) => s.ready,
  getSelectedDefinition: (s: any) => s.definition,
  getNumberOfLayers: (s: any) => s.layers,
  getShowConsoleTab: (s: any) => s.showConsole,
  getShowDesignTab: (s: any) => s.showDesign,
};
const navigate = (next: string) => {navigationCalls.push(next); location = next;};
const Link = (props: any) => React.createElement('a', {
  ...domProps(props), href: props.to,
  onClick: () => navigate(props.to),
}, props.children);
const Route = ({path, component: Component}: any) => matchRoute(path, location)[0] ? React.createElement(Component) : null;
const paneConfigs = [
  {key: 'settings', path: '/settings', component: view('legacy-settings-route')},
  {key: 'errors', path: '/errors', component: view('legacy-errors-route')},
  {key: 'test', path: '/test', component: view('tester-route')},
  {key: 'default', path: '/', component: view('keymap-route')},
  {key: 'console', path: '/console', component: view('legacy-console-route')},
];
function dependency(id: string, file: string): any {
  if (id === 'react') return {...react, default: react};
  if (id === 'react/jsx-runtime') return jsx;
  if (id === 'styled-components') return {default: styled};
  if (id === 'react-i18next') return {useTranslation: () => ({t: translate})};
  if (id === 'react-redux') return {useDispatch: () => (action: any) => {state.errors = errorReducer(state.errors, action);}};
  if (id === 'wouter') return {Link, Route, useLocation: () => [location, navigate], useRoute: (path: string) => matchRoute(path, location)};
  if (id === 'src/store/errorsSlice') return {clearAppErrors, getAppErrors};
  if (id.endsWith('store/hooks')) return {useAppSelector: (selector: any) => selector(state)};
  if (/store\/(devicesSlice|definitionsSlice|keymapSlice|settingsSlice)$/.test(id)) return selectors;
  if (id.endsWith('utils/pane-config')) return {default: paneConfigs};
  if (id.endsWith('utils/override')) return {OVERRIDE_HID_CHECK: false};
  if (id === 'src/utils/format') return {formatNumberAsHex: (n: number, width: number) => '0x' + n.toString(16).padStart(width, '0')};
  if (id === 'src/utils/device-display-name') return {getDeviceDisplayName: (d: any) => d.productName};
  if (id === '@fortawesome/react-fontawesome') return {FontAwesomeIcon: () => null};
  if (id === '@fortawesome/free-solid-svg-icons') return new Proxy({}, {get: () => ({})});
  if (id.endsWith('inputs/icon-button')) return {IconButtonContainer: view('icon-button', 'button')};
  if (id.endsWith('inputs/tooltip')) return {MenuTooltip: () => null, CategoryMenuTooltip: () => null, IconButtonTooltip: () => null};
  if (id.endsWith('custom/menu-generator')) return {MenuContainer: view('menu')};
  if (id === './grid') return emptyComponents;
  if (id === './pane') return {Pane: view('pane')};
  if (id.endsWith('/panes/settings')) return {Settings: SettingsContent};
  if (id.endsWith('configure-panes/save-load')) return {Pane: SaveLoadContent, Title: load('src/components/icons/save.tsx').title};
  if (id.endsWith('/connection-status')) return {ConnectionStatus: view('connection-status')};
  if (id.endsWith('/panes/errors')) return load('src/components/panes/errors.tsx');
  if (id.endsWith('/configurator/settings-workspace')) return load('src/components/configurator/settings-workspace.tsx');
  if (id.endsWith('/menus/global')) return {UnconnectedGlobalMenu: () => null};
  if (id.endsWith('/Home')) return {Home: (props: any) => props.children};
  if (id.endsWith('/panes/test')) return {TestContext: {Provider: (props: any) => props.children}};
  if (id.endsWith('/panes/hid-console')) return {HIDConsole: view('console')};
  if (id.endsWith('/configure-navigation')) return {ConfigureNavigationProvider: (props: any) => props.children};
  if (id.endsWith('/sidebar')) return {Sidebar: () => null};
  if (id.endsWith('/keyboard-workspace')) return {KeyboardWorkspace: () => null};
  throw new Error(`Unexpected component dependency ${id} in ${file}`);
}
function load(file: string): any {
  if (modules.has(file)) return modules.get(file);
  const source = readFileSync(resolve(root, file), 'utf8').replaceAll('import.meta.env', "({DEV: false, DEBUG_PROD: 'false'})");
  const compiled = ts.transpileModule(source, {compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: false,
  }}).outputText;
  const exports: any = {};
  modules.set(file, exports);
  runInNewContext(compiled, {
    exports, require: (id: string) => dependency(id, file),
    navigator: {}, Blob,
    window: {showSaveFilePicker: async ({suggestedName}: any) => {
      if (pickerError) throw pickerError;
      download.name = suggestedName;
      return {createWritable: async () => ({
        write: async (blob: Blob) => {download.blobs.push(blob);},
        close: async () => {download.closed = true;},
      })};
    }},
    console: {log: () => {}},
  }, {filename: file});
  return exports;
}
function expand(node: any, path = 'root'): any {
  if (Array.isArray(node)) return node.map((child, i) => expand(child, `${path}/${i}`));
  if (!React.isValidElement(node)) return node;
  const element = node as React.ReactElement<any>;
  if (typeof element.type === 'function') {
    const previousSlots = activeSlots, previousCursor = cursor;
    activeSlots = hookSlots.get(path) ?? [];
    hookSlots.set(path, activeSlots);
    cursor = 0;
    const result = element.type(element.props);
    activeSlots = previousSlots; cursor = previousCursor;
    return expand(result, path + '/component');
  }
  if (element.type === React.Fragment) return expand(element.props.children, path + '/fragment');
  return React.cloneElement(element, {key: element.key ?? path}, expand(element.props.children, path + '/children'));
}
const render = (Component: any) => expand(React.createElement(Component));
function nodes(tree: any): React.ReactElement<any>[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!React.isValidElement(tree)) return [];
  return [tree as React.ReactElement<any>, ...nodes((tree as any).props.children)];
}
const text = (tree: any): string => Array.isArray(tree) ? tree.map(text).join('') :
  React.isValidElement(tree) ? text((tree as any).props.children) : tree == null || typeof tree === 'boolean' ? '' : String(tree);
const control = (tree: any, label: string) => {
  const matches = nodes(tree).filter(n => (n.type === 'button' || n.type === 'a') && (n.props['aria-label'] === label || text(n) === label));
  expect(matches).toHaveLength(1);
  return matches[0];
};
const hasView = (tree: any, name: string) => nodes(tree).some(n => n.props['data-view'] === name);
const record = {deviceInfo: {productId: 108, vendorId: 65534, productName: 'ISOLATED TEST RECORD'}, message: 'Isolated log line 1\nIsolated log line 2'};
const {Errors} = load('src/components/panes/errors.tsx');
const {SettingsWorkspace} = load('src/components/configurator/settings-workspace.tsx');
const {default: Routes} = load('src/Routes.tsx');

beforeEach(() => {
  translate = (key) => key;
  state = {errors: errorReducer(undefined, {type: 'init'}), device: {path: 'isolated-A'}, ready: true, definition: {}, layers: 4, showConsole: false, showDesign: false};
  location = '/settings'; hookSlots = new Map(); activeSlots = []; cursor = 0;
  download = {blobs: [], closed: false}; pickerError = undefined; navigationCalls.length = 0;
});

test('confirmed empty store shows both empty-state lines and disables existing actions', () => {
  const tree = render(Errors);
  expect(text(tree)).toContain('No errors recorded');
  expect(text(tree)).toContain('Any detected errors will appear here.');
  expect(control(tree, 'Clear').props.disabled).toBe(true);
  expect(control(tree, 'Download').props.disabled).toBe(true);
  expect(renderToStaticMarkup(tree)).toContain('No errors recorded');
});

test('a real reducer record replaces empty state with message and device fields', () => {
  state.errors = errorReducer(state.errors, logAppError(record));
  const tree = render(Errors);
  expect(text(tree)).not.toContain('No errors recorded');
  expect(text(tree)).toContain('Isolated log line 1');
  expect(text(tree)).toContain('Isolated log line 2');
  expect(text(tree)).toContain('ISOLATED TEST RECORD');
  expect(text(tree)).toContain('0xfffe');
  expect(text(tree)).toContain('0x006c');
  expect(control(tree, 'Clear').props.disabled).toBe(false);
  expect(control(tree, 'Download').props.disabled).toBe(false);
});

test('existing Clear callback clears only the error list and restores empty state', () => {
  state.errors = errorReducer(state.errors, logAppError(record));
  const device = state.device;
  control(render(Errors), 'Clear').props.onClick();
  expect(getAppErrors(state)).toEqual([]);
  expect(state.device).toBe(device);
  expect(text(render(Errors))).toContain('No errors recorded');
});

test('existing Download callback serializes current records through an in-memory file picker', async () => {
  state.errors = errorReducer(state.errors, logAppError(record));
  await control(render(Errors), 'Download').props.onClick();
  expect(download.name).toBe('VIA-app-errors.csv');
  expect(download.closed).toBe(true);
  expect(download.blobs).toHaveLength(1);
  const csv = await download.blobs[0].text();
  expect(csv).toContain('timestamp, productName, vendorId, productId, message');
  expect(csv).toContain('ISOLATED TEST RECORD, 0xfffe, 0x006c');
  expect(csv).toContain('Isolated log line 1\nIsolated log line 2');
  expect(getAppErrors(state)).toHaveLength(1);
});

test('cancelled download preserves records and performs no writable operation', async () => {
  state.errors = errorReducer(state.errors, logAppError(record));
  pickerError = new Error('isolated picker cancellation');
  await control(render(Errors), 'Download').props.onClick();
  expect(download.blobs).toEqual([]);
  expect(download.closed).toBe(false);
  expect(getAppErrors(state)).toHaveLength(1);
});

test('direct Errors route uses shared Settings heading and selects only Errors', () => {
  location = '/errors';
  const tree = render(SettingsWorkspace);
  expect(nodes(tree).filter(n => n.type === 'h1').map(text)).toEqual(['Settings']);
  expect(control(tree, 'Errors').props['aria-current']).toBe('page');
  expect(control(tree, 'Settings').props['aria-selected']).toBe(false);
  expect(control(tree, 'Save & Load').props['aria-selected']).toBe(false);
  expect(text(tree)).toContain('No errors recorded');
});

test('Settings, Save & Load and Errors navigation retain one workspace state and original routes', () => {
  let tree = render(SettingsWorkspace);
  expect(hasView(tree, 'settings-content')).toBe(true);
  control(tree, 'Save & Load').props.onClick();
  tree = render(SettingsWorkspace);
  expect(location).toBe('/settings');
  expect(hasView(tree, 'save-load-content')).toBe(true);
  expect(control(tree, 'Save & Load').props['aria-selected']).toBe(true);
  control(tree, 'Errors').props.onClick();
  tree = render(SettingsWorkspace);
  expect(location).toBe('/errors');
  expect(text(tree)).toContain('No errors recorded');
  expect(hasView(tree, 'save-load-content')).toBe(false);
  control(tree, 'Save & Load').props.onClick();
  tree = render(SettingsWorkspace);
  expect(location).toBe('/settings');
  expect(hasView(tree, 'save-load-content')).toBe(true);
  control(tree, 'Settings').props.onClick();
  expect(hasView(render(SettingsWorkspace), 'settings-content')).toBe(true);
});

test.each([
  ['no device', {device: null}], ['not ready', {ready: false}],
  ['missing definition', {definition: undefined}], ['no layers', {layers: 0}],
])('Errors route retains Save & Load capability filtering: %s', (_label, values) => {
  Object.assign(state, values); location = '/errors';
  const tree = render(SettingsWorkspace);
  expect(nodes(tree).some(n => n.type === 'button' && text(n) === 'Save & Load')).toBe(false);
  expect(text(tree)).toContain('No errors recorded');
  control(tree, 'Settings').props.onClick();
  expect(hasView(render(SettingsWorkspace), 'settings-content')).toBe(true);
});

test('disconnect while Save & Load selected falls back to Settings without enabling Design', () => {
  control(render(SettingsWorkspace), 'Save & Load').props.onClick();
  state.device = null;
  const tree = render(SettingsWorkspace);
  expect(hasView(tree, 'settings-content')).toBe(true);
  expect(hasView(tree, 'save-load-content')).toBe(false);
  expect(nodes(tree).some(n => n.type === 'a' && n.props.href === '/design')).toBe(false);
});

test('Routes renders exactly one shared workspace on both URLs and retains other routes', () => {
  for (const path of ['/settings', '/errors']) {
    location = path;
    const tree = render(Routes);
    expect(nodes(tree).filter(n => n.type === 'h1' && text(n) === 'Settings')).toHaveLength(1);
    expect(hasView(tree, 'legacy-settings-route')).toBe(false);
    expect(hasView(tree, 'legacy-errors-route')).toBe(false);
  }
  location = '/test';
  const tester = render(Routes);
  expect(hasView(tester, 'tester-route')).toBe(true);
  expect(nodes(tester).filter(n => n.type === 'h1' && text(n) === 'Settings')).toHaveLength(0);
});


test('local Settings and Save & Load switches do not add duplicate route history entries', () => {
  control(render(SettingsWorkspace), 'Save & Load').props.onClick();
  control(render(SettingsWorkspace), 'Settings').props.onClick();
  expect(navigationCalls).toEqual([]);
  location = '/errors';
  control(render(SettingsWorkspace), 'Save & Load').props.onClick();
  expect(navigationCalls).toEqual(['/settings']);
  expect(hasView(render(SettingsWorkspace), 'save-load-content')).toBe(true);
});

test.each(['/errors/', '/Errors', '/ERRORS/', '/settings/', '/Settings', '/SETTINGS/'])(
  'shared shell retains installed wouter matching semantics for %s', (path) => {
    location = path;
    const tree = render(Routes);
    expect(nodes(tree).filter(n => n.type === 'h1' && text(n) === 'Settings')).toHaveLength(1);
    const errorsRoute = matchRoute('/errors', path)[0];
    expect(control(tree, 'Errors').props['aria-current']).toBe(errorsRoute ? 'page' : undefined);
    expect(text(tree).includes('No errors recorded')).toBe(errorsRoute);
    expect(hasView(tree, 'settings-content')).toBe(!errorsRoute);
  },
);

test('Save & Load content keeps the selected device instance path as its React key', () => {
  control(render(SettingsWorkspace), 'Save & Load').props.onClick();
  const rawWorkspace = () => {
    activeSlots = hookSlots.get('root')!; cursor = 0;
    return SettingsWorkspace();
  };
  let pane = nodes(rawWorkspace()).find(n => n.type === SaveLoadContent);
  expect(pane?.key).toBe('isolated-A');
  state.device = {path: 'isolated-B'};
  pane = nodes(rawWorkspace()).find(n => n.type === SaveLoadContent);
  expect(pane?.key).toBe('isolated-B');
});

test('Chinese settings navigation, error fields and empty state use the loaded translations', async () => {
  const i18n = createInstance();
  await i18n.init({lng: 'zh', resources: {zh: {translation: zh}}});
  translate = (key) => i18n.t(key);
  const settings = render(SettingsWorkspace);
  control(settings, '保存与加载').props.onClick();
  expect(hasView(render(SettingsWorkspace), 'save-load-content')).toBe(true);
  control(render(SettingsWorkspace), '错误日志').props.onClick();
  expect(text(render(SettingsWorkspace))).toContain('暂无错误记录');
  state.errors = errorReducer(state.errors, logAppError(record));
  const log = text(render(SettingsWorkspace));
  expect(log).toContain('设备');
  expect(log).toContain(record.deviceInfo.productName);
  expect(log).toContain('Isolated log line 1');
});
