import {getSelectedMacros} from 'src/store/macrosSlice';
import {FC, PropsWithChildren, useState, useEffect, useMemo, useRef} from 'react';
import styled from 'styled-components';
import {KeycodeModal} from '../../inputs/custom-keycode-modal';
import {title, component} from '../../icons/keyboard';
import * as EncoderPane from './encoder';
import {
  keycodeInMaster,
  getByteForCode,
  getKeycodes,
  getOtherMenu,
  IKeycode,
  IKeycodeMenu,
  categoriesForKeycodeModule,
  getQMKLightingKeycodes,
} from '../../../utils/key';
import {ErrorMessage} from '../../styled';
import {
  KeycodeType,
  getLightingDefinition,
  isVIADefinitionV3,
  isVIADefinitionV2,
  VIADefinitionV3,
} from '@the-via/reader';
import {SelectedKey} from './selected-key';
import {useAppDispatch, useAppSelector} from 'src/store/hooks';
import {
  getBasicKeyToByte,
  getSelectedDefinition,
  getSelectedKeyDefinitions,
} from 'src/store/definitionsSlice';
import {getSelectedConnectedDevice} from 'src/store/devicesSlice';
import {
  getSelectedKey,
  getSelectedKeymap,
  updateKey as updateKeyAction,
  updateSelectedKey,
} from 'src/store/keymapSlice';
import {getMacroCount} from 'src/store/macrosSlice';
import {
  disableGlobalHotKeys,
  enableGlobalHotKeys,
  getDisableFastRemap,
  getHostKeyboardLayout,
} from 'src/store/settingsSlice';
import {keymapExtras} from 'src/utils/keymap-extras';
import {getNextKey} from 'src/utils/keyboard-rendering';
import {useTranslation} from 'react-i18next';

const KeycodeList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, 59px);
  grid-auto-rows: 48px;
  gap: 6px 7px;
  align-content: start;
  justify-content: start;
`;

const Editor = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 56.790123%) minmax(0, 1fr);
  grid-column: 1 / -1;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  color: var(--mg-text);
  background: var(--mg-editor);
  font-family: Inter, Arial, sans-serif;
  font-weight: 400;
  letter-spacing: 0;

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
    overflow-y: auto;
    align-content: start;
  }
`;

const Palette = styled.section`
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 26px 37px 20px;
  box-sizing: border-box;

  @media (max-width: 1440px) {
    padding-right: 24px;
    padding-left: 24px;
  }

  @media (max-width: 1100px) {
    min-height: 300px;
    max-height: 409px;
  }
`;

const CategoryBar = styled.div`
  container-type: inline-size;
  display: flex;
  align-items: stretch;
  min-width: 0;
  flex-shrink: 0;
  margin-bottom: 16px;
`;

const ScrollButton = styled.button`
  flex: 0 0 26px;
  padding: 0;
  background: transparent;
  border: 0;
  color: var(--mg-text);
  border-radius: 4px;
  cursor: pointer;
  &:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }
  &:disabled { opacity: 0.3; cursor: default; }
`;

const MenuContainer = styled.div`
  position: relative;
  /* Let the raised selection paint above the scrollport without moving text. */
  padding-top: 4px;
  margin-top: -4px;
  display: flex;
  flex: 1;
  align-items: stretch;
  min-width: 0;
  gap: 10px;

  /* Long translations share the same tab metrics. Keep the roomy spacing
     when the actual palette width is sufficient. */
  @container (max-width: 780px) {
    &:lang(de), &:lang(es) {
      gap: 4px;
      --mg-category-padding: 1px;
    }
  }
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  --mg-category-mask: linear-gradient(
    to right,
    transparent var(--mg-category-start-clear, 0px),
    #000 var(--mg-category-start-fade, 0px),
    #000 calc(100% - var(--mg-category-end-fade, 0px)),
    transparent calc(100% - var(--mg-category-end-clear, 0px))
  );
  -webkit-mask-image: var(--mg-category-mask);
  mask-image: var(--mg-category-mask);

  &[data-overflow-start='true'] {
    --mg-category-start-clear: 12px;
    --mg-category-start-fade: 32px;
  }

  &[data-overflow-end='true'] {
    --mg-category-end-clear: 12px;
    --mg-category-end-fade: 32px;
  }

  &::-webkit-scrollbar {
    display: none;
  }
`;

const CategoryTab = styled.button<{$selected: boolean}>`
  position: relative;
  isolation: isolate;
  flex: 0 0 auto;
  padding: 0 var(--mg-category-padding, 6px) 6px;
  border: 0;
  /* Preserve the former underline's space without drawing a selection line. */
  border-bottom: 2px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: ${(props) =>
    props.$selected ? '#fff' : 'var(--mg-text-secondary)'};
  font: inherit;
  font-size: 14px;
  font-weight: ${(props) => (props.$selected ? 600 : 500)};
  line-height: 20px;
  letter-spacing: 1px;
  text-transform: uppercase;
  white-space: nowrap;
  cursor: pointer;
  transition: color 140ms ease, background-color 140ms ease;

  &::before {
    content: '';
    position: absolute;
    /* Include the transparent bottom border in the original background size. */
    inset: 0 0 -2px;
    transform: translateY(-4px);
    z-index: -1;
    border-radius: 6px;
    background: ${(props) =>
      props.$selected ? 'var(--mg-header)' : 'transparent'};
    pointer-events: none;
  }

  &:hover {
    color: ${(props) => (props.$selected ? '#fff' : 'var(--mg-text)')};
  }

  &:hover::before {
    background: ${(props) =>
      props.$selected ? 'var(--mg-header)' : 'var(--mg-nav-active)'};
  }

  &:focus-visible {
    outline: none;
  }

  /* A same-button pointer click can retain native :focus-visible in Chrome. */
  &:focus-visible:not([data-pointer-focus])::after {
    content: '';
    position: absolute;
    inset: 0;
    border: 2px solid
      ${(props) => props.$selected ? 'var(--mg-text-secondary)' : 'var(--mg-text)'};
    border-radius: 6px;
    pointer-events: none;
  }
`;

const CategoryStrip: FC<PropsWithChildren> = ({children}) => {
  const {t, i18n} = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({overflow: false, start: false, end: false});
  const scrollPage = (direction: number) => {
    const strip = ref.current;
    if (strip) strip.scrollBy({left: direction * Math.max(1, strip.clientWidth - 32)});
  };

  useEffect(() => {
    const strip = ref.current;
    const bar = barRef.current;
    if (!strip || !bar) return;
    const updateEdges = () => {
      const overflow = strip.scrollWidth > bar.clientWidth + 1;
      const start = strip.scrollLeft > 1;
      const end = strip.scrollWidth - strip.clientWidth - strip.scrollLeft > 1;
      setEdges((previous) =>
        previous.overflow === overflow && previous.start === start && previous.end === end
          ? previous
          : {overflow, start, end},
      );
    };
    const scrollCategories = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const limit = strip.scrollWidth - strip.clientWidth;
      if (limit <= 0) return;
      const unit =
        event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? strip.clientWidth : 1;
      const next = Math.max(
        0,
        Math.min(limit, strip.scrollLeft + event.deltaY * unit),
      );
      if (next === strip.scrollLeft) return;
      event.preventDefault();
      strip.scrollLeft = next;
    };
    strip.addEventListener('wheel', scrollCategories, {passive: false});
    strip.addEventListener('scroll', updateEdges, {passive: true});
    const observer = new ResizeObserver(updateEdges);
    observer.observe(strip);
    observer.observe(bar);
    // Text width can change independently of the viewport (locale or font load).
    Array.from(strip.children).forEach((tab) => observer.observe(tab));
    updateEdges();
    return () => {
      strip.removeEventListener('wheel', scrollCategories);
      strip.removeEventListener('scroll', updateEdges);
      observer.disconnect();
    };
  }, [children]);

  return (
    <CategoryBar ref={barRef}>
      {edges.overflow && (
        <ScrollButton type="button" aria-label={t('Previous keycode categories')}
          disabled={!edges.start} onClick={() => scrollPage(-1)}>‹</ScrollButton>
      )}
      <MenuContainer
        lang={i18n.resolvedLanguage || i18n.language}
        ref={ref}
        data-overflow-start={edges.start}
        data-overflow-end={edges.end}
        aria-label={t('Keycode categories')}
        onFocusCapture={(event) => {
          const strip = event.currentTarget;
          const viewport = strip.getBoundingClientRect();
          const focused = event.target.getBoundingClientRect();
          const left = viewport.left + (strip.scrollLeft > 1 ? 32 : 0);
          const right =
            viewport.right -
            (strip.scrollWidth - strip.clientWidth - strip.scrollLeft > 1 ? 32 : 0);
          if (focused.left < left) {
            strip.scrollLeft += focused.left - left;
          }
          if (focused.right > right) {
            strip.scrollLeft += focused.right - right;
          }
        }}
      >
        {children}
      </MenuContainer>
      {edges.overflow && (
        <ScrollButton type="button" aria-label={t('Next keycode categories')}
          disabled={!edges.end} onClick={() => scrollPage(1)}>›</ScrollButton>
      )}
    </CategoryBar>
  );
};

const Keycode = styled.button<{$selected?: boolean}>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 48px;
  padding: 3px;
  box-sizing: border-box;
  line-height: 16px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0;
  border: 1px solid
    ${(props) =>
      props.$selected ? 'var(--mg-text)' : 'var(--mg-keycode-border)'};
  background: ${(props) =>
    props.$selected ? 'var(--mg-selected)' : 'var(--mg-editor)'};
  color: var(--mg-text);
  margin: 0;
  box-shadow: none;
  position: relative;
  white-space: pre-wrap;
  cursor: pointer;
  transition: background 140ms, border-color 140ms;

  &:hover:not(:disabled) {
    border-color: ${(props) =>
      props.$selected ? 'var(--mg-text)' : 'var(--mg-text-secondary)'};
    background: ${(props) =>
      props.$selected ? 'var(--mg-selected)' : 'var(--mg-nav-active)'};
  }

  &:active:not(:disabled) {
    border-color: var(--mg-text);
    box-shadow: inset 0 0 0 1px var(--mg-text);
  }

  &:focus-visible {
    outline: 2px solid var(--mg-text);
    outline-offset: -3px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

const KeycodeContent = styled.span<{$longLabel?: boolean}>`
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  max-width: 100%;
  max-height: 32px;
  font-size: ${(props) => (props.$longLabel ? '12px' : '14px')};
  font-weight: 500;
  line-height: 16px;
  letter-spacing: 0;
  overflow-wrap: anywhere;
  text-overflow: ellipsis;
  overflow: hidden;
`;

const KeycodeContainer = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior-y: contain;
  padding: 1px;

  &:focus-visible {
    border-radius: 8px;
  }

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 6px;
    background: var(--mg-border);
  }

  &::-webkit-scrollbar-thumb:hover {
    background: var(--mg-text-secondary);
  }
`;

const KeycodeDesc = styled.div`
  flex: 0 0 auto;
  min-height: 16px;
  margin-top: 8px;
  color: var(--mg-text-secondary);
  font-size: 11px;
  font-weight: 400;
  line-height: 16px;
  letter-spacing: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const generateKeycodeCategories = (
  basicKeyToByte: Record<string, number>,
  numMacros: number = 16,
) => getKeycodes(numMacros).concat(getOtherMenu(basicKeyToByte));

const maybeFilter = <M extends Function>(maybe: boolean, filter: M) =>
  maybe ? () => true : filter;

export const Pane: FC = () => {
  const selectedKey = useAppSelector(getSelectedKey);
  const dispatch = useAppDispatch();
  const keys = useAppSelector(getSelectedKeyDefinitions);
  useEffect(
    () => () => {
      dispatch(updateSelectedKey(null));
    },
    [],
  ); // componentWillUnmount equiv

  if (selectedKey !== null && keys[selectedKey]?.ei !== undefined) {
    return <EncoderPane.Pane />;
  }
  return <KeycodePane />;
};

export const KeycodePane: FC = () => {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const macros = useAppSelector(getSelectedMacros);
  const selectedDefinition = useAppSelector(getSelectedDefinition);
  const selectedDevice = useAppSelector(getSelectedConnectedDevice);
  const matrixKeycodes = useAppSelector(getSelectedKeymap);
  const selectedKey = useAppSelector(getSelectedKey);
  const disableFastRemap = useAppSelector(getDisableFastRemap);
  const selectedKeyDefinitions = useAppSelector(getSelectedKeyDefinitions);
  const {basicKeyToByte} = useAppSelector(getBasicKeyToByte);
  const macroCount = useAppSelector(getMacroCount);
  const hostKeyboardLayout = useAppSelector(getHostKeyboardLayout);
  const keycodeLUT = keymapExtras[hostKeyboardLayout]?.keycodeLUT;

  const KeycodeCategories = useMemo(
    () =>
      generateKeycodeCategories(basicKeyToByte, macroCount).map((category) =>
        category.id === 'qmk_lighting' && selectedDefinition && selectedDevice
          ? {
              ...category,
              keycodes: getQMKLightingKeycodes(
                selectedDefinition,
                selectedDevice.protocol,
              ),
            }
          : category,
      ),
    [basicKeyToByte, macroCount, selectedDefinition, selectedDevice],
  );

  const [selectedCategory, setSelectedCategory] = useState(
    KeycodeCategories[0].id,
  );
  const [mouseOverDesc, setMouseOverDesc] = useState<string | null>(null);
  const [showKeyTextInputModal, setShowKeyTextInputModal] = useState(false);

  useEffect(() => {
    if (showKeyTextInputModal) {
      dispatch(disableGlobalHotKeys());
      return () => {
        dispatch(enableGlobalHotKeys());
      };
    }
  }, [dispatch, showKeyTextInputModal]);

  if (!selectedDefinition || !selectedDevice || !matrixKeycodes) {
    return null;
  }

  const getEnabledMenus = (): IKeycodeMenu[] => {
    if (isVIADefinitionV3(selectedDefinition)) {
      return getEnabledMenusV3(selectedDefinition);
    }
    const {lighting, customKeycodes} = selectedDefinition;
    const {keycodes} = getLightingDefinition(lighting);
    return KeycodeCategories.filter(
      maybeFilter(
        keycodes === KeycodeType.QMK,
        ({id}) => id !== 'qmk_lighting',
      ),
    )
      .filter(
        maybeFilter(keycodes === KeycodeType.WT, ({id}) => id !== 'lighting'),
      )
      .filter(
        maybeFilter(
          typeof customKeycodes !== 'undefined',
          ({id}) => id !== 'custom',
        ),
      );
  };
  const getEnabledMenusV3 = (definition: VIADefinitionV3): IKeycodeMenu[] => {
    const keycodes = ['default' as const, ...(definition.keycodes || [])];
    const allowedKeycodes = keycodes.flatMap((keycodeName) =>
      categoriesForKeycodeModule(keycodeName),
    );
    if ((selectedDefinition.customKeycodes || []).length !== 0) {
      allowedKeycodes.push('custom');
    }
    return KeycodeCategories.filter((category) =>
      allowedKeycodes.includes(category.id),
    );
  };

  const renderMacroError = () => {
    return (
      <ErrorMessage>
        {t(
          'Your current firmware does not support macros. Install the latest firmware for your device.',
        )}
      </ErrorMessage>
    );
  };

  const renderCategories = () => {
    return (
      <CategoryStrip>
        {enabledMenus.map(({id, label}) => (
          <CategoryTab
            type="button"
            $selected={id === activeCategory}
            aria-pressed={id === activeCategory}
            onPointerDown={(event) => {
              event.currentTarget.dataset.pointerFocus = 'true';
            }}
            onKeyDown={(event) => {
              delete event.currentTarget.dataset.pointerFocus;
            }}
            onBlur={(event) => {
              delete event.currentTarget.dataset.pointerFocus;
            }}
            onClick={() => setSelectedCategory(id)}
            key={id}
          >
            {t(label)}
          </CategoryTab>
        ))}
      </CategoryStrip>
    );
  };

  const renderKeyInputModal = () => {
    return (
      <KeycodeModal
        defaultValue={
          selectedKey !== null ? matrixKeycodes[selectedKey] : undefined
        }
        onExit={() => {
          dispatch(enableGlobalHotKeys());
          setShowKeyTextInputModal(false);
        }}
        onConfirm={(keycode) => {
          dispatch(enableGlobalHotKeys());
          updateKey(keycode);
          setShowKeyTextInputModal(false);
        }}
      />
    );
  };

  const updateKey = (value: number) => {
    if (selectedKey !== null) {
      dispatch(updateKeyAction(selectedKey, value));
      dispatch(
        updateSelectedKey(
          disableFastRemap || !selectedKeyDefinitions
            ? null
            : getNextKey(selectedKey, selectedKeyDefinitions),
        ),
      );
    }
  };

  const handleClick = (code: string, i: number) => {
    if (code == 'text') {
      setShowKeyTextInputModal(true);
    } else {
      return (
        keycodeInMaster(code, basicKeyToByte) &&
        updateKey(getByteForCode(code, basicKeyToByte))
      );
    }
  };

  const renderKeycode = (keycode: IKeycode, index: number) => {
    const {code} = keycode;
    const lutEntry = keycodeLUT && code ? keycodeLUT[code] : undefined;
    const name = lutEntry ? lutEntry.name : keycode.name;
    const title = lutEntry?.title ?? keycode.title;
    const isSelected =
      selectedKey !== null &&
      keycodeInMaster(code, basicKeyToByte) &&
      matrixKeycodes[selectedKey] === getByteForCode(code, basicKeyToByte);
    return (
      <Keycode
        key={code}
        type="button"
        aria-label={title ? `${name}: ${title}` : name}
        aria-pressed={isSelected}
        title={title ? `${name} (${code}): ${title}` : `${name} (${code})`}
        disabled={
          selectedKey === null ||
          (!keycodeInMaster(code, basicKeyToByte) && code != 'text')
        }
        $selected={isSelected}
        onClick={() => handleClick(code, index)}
        onMouseOver={() => setMouseOverDesc(title ? `${code}: ${title}` : code)}
        onMouseOut={() => setMouseOverDesc(null)}
        onFocus={() => setMouseOverDesc(title ? `${code}: ${title}` : code)}
        onBlur={() => setMouseOverDesc(null)}
      >
        <KeycodeContent $longLabel={name.length > 6}>{name}</KeycodeContent>
      </Keycode>
    );
  };

  const renderCustomKeycode = () => {
    return (
      <Keycode
        type="button"
        key="customKeycode"
        title={t('Enter any QMK Keycode')}
        aria-label={t('Enter any QMK Keycode')}
        disabled={selectedKey === null}
        onClick={() => selectedKey !== null && handleClick('text', 0)}
        onMouseOver={() => setMouseOverDesc(t('Enter any QMK Keycode'))}
        onMouseOut={() => setMouseOverDesc(null)}
        onFocus={() => setMouseOverDesc(t('Enter any QMK Keycode'))}
        onBlur={() => setMouseOverDesc(null)}
      >
        <KeycodeContent>Any</KeycodeContent>
      </Keycode>
    );
  };

  const renderSelectedCategory = (
    keycodes: IKeycode[],
    selectedCategory: string,
  ) => {
    const keycodeListItems = keycodes.map((keycode, i) =>
      renderKeycode(keycode, i),
    );
    switch (selectedCategory) {
      case 'macro': {
        return !macros.isFeatureSupported ? (
          renderMacroError()
        ) : (
          <KeycodeList>{keycodeListItems}</KeycodeList>
        );
      }
      case 'special': {
        return (
          <KeycodeList>
            {keycodeListItems.concat(renderCustomKeycode())}
          </KeycodeList>
        );
      }
      case 'custom': {
        if (
          (!isVIADefinitionV2(selectedDefinition) &&
            !isVIADefinitionV3(selectedDefinition)) ||
          !selectedDefinition.customKeycodes
        ) {
          return null;
        }
        return (
          <KeycodeList>
            {selectedDefinition.customKeycodes.map((keycode, idx) => {
              return renderKeycode(
                {
                  ...keycode,
                  code: `CUSTOM(${idx})`,
                },
                idx,
              );
            })}
          </KeycodeList>
        );
      }
      default: {
        return <KeycodeList>{keycodeListItems}</KeycodeList>;
      }
    }
  };

  const enabledMenus = getEnabledMenus();
  const activeCategory = enabledMenus.some(({id}) => id === selectedCategory)
    ? selectedCategory
    : enabledMenus[0]?.id || 'basic';
  const selectedCategoryKeycodes =
    enabledMenus.find(({id}) => id === activeCategory)?.keycodes || [];

  return (
    <Editor aria-label={t('Keymap editor')}>
      <Palette aria-label={t('Keycodes')}>
        {renderCategories()}
        <KeycodeContainer>
          {renderSelectedCategory(selectedCategoryKeycodes, activeCategory)}
        </KeycodeContainer>
        <KeycodeDesc title={mouseOverDesc || undefined}>{mouseOverDesc}</KeycodeDesc>
      </Palette>
      <SelectedKey onEdit={() => setShowKeyTextInputModal(true)} />
      {showKeyTextInputModal && renderKeyInputModal()}
    </Editor>
  );
};

export const Icon = component;
export const Title = title;
