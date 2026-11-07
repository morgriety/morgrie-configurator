import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  CustomFeaturesV2,
  getLightingDefinition,
  isVIADefinitionV2,
  isVIADefinitionV3,
} from '@the-via/reader';
import {useAppSelector} from 'src/store/hooks';
import {getSelectedDefinition} from 'src/store/definitionsSlice';
import {getSelectedDevicePath} from 'src/store/devicesSlice';
import {getNumberOfLayers} from 'src/store/keymapSlice';
import {getIsMacroFeatureSupported} from 'src/store/macrosSlice';
import {getV3MenuComponents} from 'src/store/menusSlice';
import * as Keycode from '../panes/configure-panes/keycode';
import * as Macros from '../panes/configure-panes/macros';
import * as Lighting from '../panes/configure-panes/lighting';
import * as Layouts from '../panes/configure-panes/layouts';
import * as SaveLoad from '../panes/configure-panes/save-load';
import * as RotaryEncoder from '../panes/configure-panes/custom/satisfaction75';

type ConfigureMenu = {
  id: string;
  Title: string;
  Icon: React.ComponentType<any>;
  Pane: React.ComponentType<any>;
};

type ConfigureNavigation = {
  rows: ConfigureMenu[];
  selectedId: string;
  selectedTitle: string;
  selectPane: (id: string) => void;
  selectedPane?: ConfigureMenu;
};

const NavigationContext = createContext<ConfigureNavigation | null>(null);

export const ConfigureNavigationProvider = ({children}: PropsWithChildren) => {
  const definition = useAppSelector(getSelectedDefinition);
  const devicePath = useAppSelector(getSelectedDevicePath);
  const numberOfLayers = useAppSelector(getNumberOfLayers);
  const showMacros = useAppSelector(getIsMacroFeatureSupported);
  const v3Menus = useAppSelector(getV3MenuComponents);
  const [requestedId, selectPane] = useState('keymap');

  useEffect(() => {
    selectPane('keymap');
  }, [devicePath]);

  let rows: ConfigureMenu[] = [];
  if (definition) {
    rows = [
      {...Keycode, id: 'keymap'},
      {...Macros, id: 'macros'},
      {...Layouts, id: 'layouts'},
      {...SaveLoad, id: 'save-load'},
    ];
    if (isVIADefinitionV2(definition)) {
      if (
        getLightingDefinition(definition.lighting).supportedLightingValues.length
      ) {
        rows.push({...Lighting, id: 'v2-lighting'});
      }
      if (definition.customFeatures?.includes(CustomFeaturesV2.RotaryEncoder)) {
        rows.push({...RotaryEncoder, id: 'rotary-encoder'});
      }
    } else if (isVIADefinitionV3(definition)) {
      rows.push(
        ...v3Menus.map((row, index) => ({
          ...row,
          id: `custom:${index}:${row.Title}`,
        })),
      );
    }
    rows = rows.filter((row) => {
      if (row.id === 'layouts') {
        return (
          !!definition.layouts.optionKeys &&
          Object.keys(definition.layouts.optionKeys).length > 0
        );
      }
      if (row.id === 'keymap' || row.id === 'save-load') return numberOfLayers > 0;
      if (row.id === 'macros') return showMacros;
      return true;
    });
  }

  const selectedPane = rows.find((row) => row.id === requestedId) || rows[0];
  return (
    <NavigationContext.Provider
      value={{
        rows,
        selectedId: selectedPane?.id || 'keymap',
        selectedTitle: selectedPane?.Title || 'Keymap',
        selectedPane,
        selectPane,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useConfigureNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('Configure navigation must be inside its provider');
  }
  return context;
};
