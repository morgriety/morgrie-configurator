import {current} from '@reduxjs/toolkit';
import {
  DefinitionVersionMap,
  getTheme,
  KeyboardDefinitionIndex,
  ThemeDefinition,
} from '@the-via/reader';
import {TestKeyboardSoundsMode} from 'src/components/void/test-keyboard-sounds';
import {MORGRIE_LIGHT, THEMES} from 'src/utils/themes';
import {Store} from '../shims/via-app-store';
import type {
  AuthorizedDevice,
  DefinitionIndex,
  Settings,
  VendorProductIdMap,
} from '../types/types';
import {getVendorProductId} from './hid-keyboards';
import {getDefinitionKey, resolveModelDefinition, type DefinitionDictionary} from './model-definitions';
let deviceStore: Store;
const defaultStoreData = {
  definitionIndex: {
    generatedAt: -1,
    hash: '',
    version: '2.0.0',
    theme: getTheme(),
    accentColor: '#ad7070',
    supportedVendorProductIdMap: {},
  },
  definitions: {},
  settings: {
    showDesignTab: false,
    showConsoleTab: false,
    disableFastRemap: false,
    ShowSliderValuesMode: 'Slider Only' as const,
    renderMode: '2D' as const,
    themeMode: 'dark' as const,
    designDefinitionVersion: 'v3' as const,
    themeName: MORGRIE_LIGHT,
    hostKeyboardLayout: 'keymap_us',
    macroEditor: {
      smartOptimizeEnabled: true,
      recordDelaysEnabled: false,
      tapEnterAtEOMEnabled: false,
    },
    testKeyboardSoundsSettings: {
      isEnabled: true,
      volume: 100,
      waveform: 'sine' as const,
      mode: TestKeyboardSoundsMode.WickiHayden,
      transpose: 0,
    },
  },
};

function initDeviceStore() {
  deviceStore = new Store(defaultStoreData);
}

initDeviceStore();

// TODO: invalidate cache if we change cache structure

/** Retreives the latest definition index and invalidates the definition cache if a new one is found */
export async function syncStore(): Promise<DefinitionIndex> {
  const currentDefinitionIndex = deviceStore.get('definitionIndex');

  // TODO: fall back to cache if can't hit endpoint, notify user
  try {
    // Get hash file
    //    const hash = await (await fetch('/definitions/hash.json')).json();
    const hash = document.getElementById('definition_hash')?.dataset.hash || '';

    if (hash === currentDefinitionIndex.hash) {
      return currentDefinitionIndex;
    }
    // Get definition index file
    const response = await fetch('/definitions/supported_kbs.json', {
      cache: 'reload',
    });
    const json: KeyboardDefinitionIndex = await response.json();

    // TODO: maybe we should just export this shape from keyboards repo
    // v3 is a superset of v2 - if the def is avail in v2, it is also avail in v3
    const v2vpidMap = json.vendorProductIds.v2.reduce(
      (acc: VendorProductIdMap, id) => {
        acc[id] = acc[id] || {};
        acc[id].v2 = acc[id].v3 = true;
        return acc;
      },
      {},
    );

    const vpidMap = json.vendorProductIds.v3.reduce(
      (acc: VendorProductIdMap, def) => {
        acc[def] = acc[def] || {};
        acc[def].v3 = true;
        return acc;
      },
      v2vpidMap,
    );

    const newIndex = {
      ...json,
      hash,
      supportedVendorProductIdMap: vpidMap,
    };
    deviceStore.set('definitionIndex', newIndex);
    deviceStore.set('definitions', {});

    return newIndex;
  } catch (e) {
    console.warn(e);
  }

  return currentDefinitionIndex;
}

export const getMissingDefinition = async <
  K extends keyof DefinitionVersionMap,
>(
  device: AuthorizedDevice,
  version: K,
): Promise<[DefinitionVersionMap[K], K]> => {
  const identity = {...device, requiredDefinitionVersion: version};
  const resolution = resolveModelDefinition(identity);
  const key = getDefinitionKey(identity);
  if (resolution.kind === 'unresolved' || key === undefined) {
    throw new Error('Cannot load a definition for an unresolved keyboard model');
  }
  const vpid = getVendorProductId(device.vendorId, device.productId);
  const resource = resolution.kind === 'model' ? resolution.resourcePath : `${version}/${vpid}.json`;
  const url = `/definitions/${resource}`;
  const response = await fetch(url, resolution.kind === 'model' ? {cache: 'reload'} : undefined);
  if (!response.ok) throw new Error(`Definition resource unavailable: ${resource}`);
  const json: DefinitionVersionMap[K] = await response.json();
  if (json.vendorProductId !== vpid) throw new Error('Definition USB identity does not match the device');
  let definitions = deviceStore.get('definitions');
  const newDefinitions = {
    ...definitions,
    [key]: {
      ...definitions[key],
      [version]: json,
    },
  };

  // Persistence failures must not erase unrelated settings, overrides or grants.
  deviceStore.set('definitions', newDefinitions);
  return [json, version];
};

export const getSupportedIdsFromStore = (): VendorProductIdMap =>
  deviceStore.get('definitionIndex')?.supportedVendorProductIdMap;

export const getDefinitionsFromStore = (): DefinitionDictionary =>
  deviceStore.get('definitions');

export const getThemeFromStore = (): ThemeDefinition =>
  THEMES[getThemeNameFromStore() as keyof typeof THEMES] ||
  deviceStore.get('definitionIndex')?.theme;

export const getThemeModeFromStore = (): 'dark' | 'light' => {
  return deviceStore.get('settings')?.themeMode;
};

export const getShowSliderValuesModeFromStore = (): 'Slider & Show Value' | 'Slider & Input Field' | 'Slider Only' => {
  return deviceStore.get('settings')?.ShowSliderValuesMode;
};

export const getRenderModeFromStore = (): '3D' | '2D' => {
  return deviceStore.get('settings')?.renderMode;
};

export const getSettings = (): Settings => {
  const settings = deviceStore.get('settings');
  if (
    typeof settings?.themeName === 'string' &&
    Object.prototype.hasOwnProperty.call(THEMES, settings.themeName)
  ) {
    return settings;
  }
  return {...settings, themeName: MORGRIE_LIGHT};
};

export const getThemeNameFromStore = () => getSettings().themeName;

export const setSettings = (settings: Settings) => {
  deviceStore.set('settings', current(settings));
};
