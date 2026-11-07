import {getSelectedMacros} from 'src/store/macrosSlice';
import {useContext, useId, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {getKeyboardFocusTarget, getNavigableKeyName} from './key-navigation';
import {keycodesList} from 'src/utils/key';
import {getMorgrieLegend, MorgrieScaleContext} from './morgrie-legend';
import {getBasicKeyToByte} from 'src/store/definitionsSlice';
import {useAppDispatch, useAppSelector} from 'src/store/hooks';
import {getSelectedKey, updateSelectedKey} from 'src/store/keymapSlice';
import {getExpressions} from 'src/store/macrosSlice';
import {getHostKeyboardLayout, getSelectedTheme} from 'src/store/settingsSlice';
import {keymapExtras} from 'src/utils/keymap-extras';
import {DisplayMode, KeyGroupProps, KeysKeys} from 'src/types/keyboard-rendering';
import {getRGB} from 'src/utils/color-math';
import {
  calculateKeyboardFrameDimensions,
  CSSVarObject,
  getComboKeyProps,
  getKeyboardRowPartitions,
} from 'src/utils/keyboard-rendering';
import {useSkipFontCheck} from 'src/utils/use-skip-font-check';
import styled from 'styled-components';
import {Color} from 'three';
import {
  getKeycapSharedProps,
  getKeysKeys,
  getLabels,
} from '../n-links/key-group';
import {CaseInsideBorder} from './case';
import {Keycap} from './unit-key/keycap';

const KeyGroupContainer = styled.div<{height: number; width: number}>`
  position: absolute;
  top: ${(p) => CaseInsideBorder * 1.5}px;
  left: ${(p) => CaseInsideBorder * 1.5}px;
  [data-key-index]:focus {
    /* The dedicated child SVG paints above the material without changing layout. */
    outline: none;
    z-index: 2;
  }
`;

const getPosition = (x: number, y: number): [number, number, number] => [
  x - CSSVarObject.keyWidth / 2,
  y - CSSVarObject.keyHeight / 2,
  0,
];
const getRGBArray = (keyColors: number[][]) => {
  return keyColors.map(([hue, sat]) => {
    const rgbStr = getRGB({
      hue: Math.round((255 * hue) / 360),
      sat: Math.round(255 * sat),
    });
    const srgbStr = `#${new Color(rgbStr).getHexString()}`;
    const keyColor = {c: srgbStr, t: srgbStr};
    return keyColor;
  });
};

const shortNames = new Map(keycodesList.filter((entry) => entry.shortName).map((entry) => [entry.code, entry.shortName]));

export const KeyGroup: React.FC<KeyGroupProps<React.MouseEvent>> = (props) => {
  const {t} = useTranslation();
  const hintId = useId();
  const [focused, setFocused] = useState<number | null>(null);
  const dispatch = useAppDispatch();
  const selectedKey = useAppSelector(getSelectedKey);
  const selectedTheme = useAppSelector(getSelectedTheme);
  const macroExpressions = useAppSelector(getExpressions);
  const skipFontCheck = useSkipFontCheck();
  const keyColorPalette = props.keyColors
    ? getRGBArray(props.keyColors)
    : selectedTheme;
  const {basicKeyToByte, byteToKey} = useAppSelector(getBasicKeyToByte);
  const hostKeyboardLayout = useAppSelector(getHostKeyboardLayout);
  const keycodeLUT = keymapExtras[hostKeyboardLayout]?.keycodeLUT;
  const macros = useAppSelector(getSelectedMacros);
  const {keys, selectedKey: externalSelectedKey} = props;
  const selectedKeyIndex =
    externalSelectedKey === undefined ? selectedKey : externalSelectedKey;
  const navigable = props.mode === DisplayMode.Configure && !!props.selectable;
  const rows = useMemo(
    () => navigable ? getKeyboardRowPartitions(keys.filter((key) => !key.d)).partitionedKeys : [],
    [keys, navigable],
  );
  const tabStop = [focused, selectedKeyIndex].find((index) =>
    index != null && keys[index] && !keys[index].d,
  ) ?? keys.indexOf(rows[0]?.[0]);
  const keysKeys: KeysKeys<React.MouseEvent> = useMemo(() => {
    return getKeysKeys(props, keyColorPalette, dispatch, getPosition);
  }, [
    keys,
    keyColorPalette,
    props.onKeycapPointerDown,
    props.onKeycapPointerOver,
  ]);
  const brandLegends = useContext(MorgrieScaleContext) !== null;
  const labels = useMemo(() => {
    const originals = getLabels(props, macroExpressions, basicKeyToByte, byteToKey, keycodeLUT);
    if (!brandLegends) return originals;
    return originals.map((legend, i) => {
      if (!legend) return legend;
      const code = byteToKey[props.matrixKeycodes[i]];
      return getMorgrieLegend(legend, code, keycodeLUT?.[code] ? undefined : shortNames.get(code));
    });
  }, [brandLegends, keys, props.matrixKeycodes, macros, macroExpressions, props.definition, basicKeyToByte, byteToKey, keycodeLUT]);
  const {width, height} = calculateKeyboardFrameDimensions(keys);
  const elems = useMemo(() => {
    return props.keys.map((k, i) => {
      const keyName = navigable
        ? getNavigableKeyName(labels[i] || undefined, props.matrixKeycodes[i], basicKeyToByte, byteToKey)
        : '';
      return k.d ? null : (
        <Keycap
          navigation={navigable ? {
            role: 'button',
            tabIndex: tabStop === i ? 0 : -1,
            'data-key-index': i,
            'aria-pressed': selectedKeyIndex === i,
            'aria-label': `${keyName} (${k.row}, ${k.col})`.trim(),
          } : undefined}
          {...getComboKeyProps(k)}
          {...getKeycapSharedProps(
            k,
            i,
            props,
            keysKeys,
            selectedKeyIndex,
            labels,
            skipFontCheck,
          )}
        />
      );
    });
  }, [
    keys,
    selectedKeyIndex,
    labels,
    props.pressedKeys,
    props.selectable,
    navigable,
    tabStop,
    basicKeyToByte,
    byteToKey,
    props.matrixKeycodes,
    keyColorPalette,
    props.definition.vendorProductId,
    skipFontCheck,
  ]);
  return (
    <KeyGroupContainer
      role={navigable ? 'toolbar' : undefined}
      aria-label={navigable ? t('Keyboard keys') : undefined}
      aria-describedby={navigable ? hintId : undefined}
      onFocus={navigable ? (event) => {
        const index = (event.target as HTMLElement).dataset.keyIndex;
        if (index !== undefined) setFocused(Number(index));
      } : undefined}
      onBlur={navigable ? (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(null);
      } : undefined}
      onKeyDown={navigable ? (event) => {
        const index = (event.target as HTMLElement).dataset.keyIndex;
        if (index === undefined || event.altKey || event.ctrlKey || event.metaKey) return;
        const current = Number(index);
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) dispatch(updateSelectedKey(event.key === 'Escape' ? null : current));
          return;
        }
        const next = getKeyboardFocusTarget(keys[current], rows, event.key);
        if (!next) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.querySelector<HTMLElement>(`[data-key-index="${keys.indexOf(next)}"]`)?.focus();
      } : undefined}
      height={height}
      width={width}
      style={{pointerEvents: props.selectable ? 'all' : 'none'}}
    >
      {navigable && (
        <span id={hintId} hidden>
          {t('Use the arrow keys to move, Enter or Space to select, and Escape to clear selection.')}
        </span>
      )}
      {elems}
    </KeyGroupContainer>
  );
};
